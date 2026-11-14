// Package simulator saves each member's practice rounds and orders their next practice.
package simulator

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/admin"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrInvalid           = errors.New("invalid round or answer")
	ErrNothingToPractice = errors.New("nothing to practice")
	ErrAlreadyAnswered   = errors.New("already answered")
)

var skills = []string{"feeding", "soothing", "safe_sleep", "diapering", "warning_signs", "teamwork"}

type Score struct {
	Skill             string
	Answered, Correct int
	Percent           *int
	Weak              bool
}

type Progress struct {
	Scores    []Score
	Completed int
}

type Round struct {
	Row       store.SimulatorRound
	Questions []content.PracticeQuestion
	Answers   map[string]store.SimulatorAnswer
	Scores    []Score
}

func Scenario(id string) (content.PracticeScenario, bool) {
	for _, scenario := range content.PracticeScenarios() {
		if scenario.ID == id {
			return scenario, true
		}
	}
	return content.PracticeScenario{}, false
}

func scores(history []store.SimulatorAnswer) []Score {
	result := make([]Score, 0, len(skills))
	for _, skill := range skills {
		score := Score{Skill: skill}
		for _, answer := range history {
			if answer.Skill != skill {
				continue
			}
			score.Answered++
			if answer.Correct {
				score.Correct++
			}
		}
		if score.Answered > 0 {
			percent := 100 * score.Correct / score.Answered
			score.Percent = &percent
			score.Weak = 100*score.Correct < 70*score.Answered
		}
		result = append(result, score)
	}
	return result
}

func WeakSpots(scores []Score) []string {
	weak := make([]Score, 0)
	for _, score := range scores {
		if score.Weak {
			weak = append(weak, score)
		}
	}
	slices.SortStableFunc(weak, func(a, b Score) int { return *a.Percent - *b.Percent })
	ids := make([]string, 0, len(weak))
	for _, score := range weak {
		ids = append(ids, score.Skill)
	}
	return ids
}

func practiceIDs(history []store.SimulatorAnswer) []string {
	latest := make(map[string]store.SimulatorAnswer)
	catalog := make(map[string]bool)
	for _, question := range content.PracticeQuestions() {
		catalog[question.ID] = true
	}
	wrong, right := []string{}, []string{}
	for _, answer := range history {
		if _, seen := latest[answer.QuestionID]; seen || !catalog[answer.QuestionID] {
			continue
		}
		latest[answer.QuestionID] = answer
		if answer.Correct {
			right = append(right, answer.QuestionID)
		} else {
			wrong = append(wrong, answer.QuestionID)
		}
	}
	weak := WeakSpots(scores(history))
	for _, skill := range weak {
		for _, question := range content.PracticeQuestions() {
			if _, seen := latest[question.ID]; !seen && question.Skill == skill {
				wrong = append(wrong, question.ID)
			}
		}
	}
	slices.Reverse(right)
	ids := append(wrong, right...)
	return ids[:min(8, len(ids))]
}

func loadRound(ctx context.Context, q *store.Queries, row store.SimulatorRound) (Round, error) {
	out := Round{Row: row, Answers: make(map[string]store.SimulatorAnswer), Questions: make([]content.PracticeQuestion, 0, len(row.QuestionIds))}
	catalog := content.PracticeQuestions()
	edits, err := admin.Edits(ctx, q, row.FamilyID)
	if err != nil {
		return Round{}, err
	}
	for _, id := range row.QuestionIds {
		index := slices.IndexFunc(catalog, func(item content.PracticeQuestion) bool { return item.ID == id })
		if index < 0 {
			return Round{}, fmt.Errorf("unknown stored simulator question %q", id)
		}
		item := catalog[index]
		_, item.Prompt = edits.Apply(content.ItemSimulatorQuestion, id, item.Skill, item.Prompt)
		out.Questions = append(out.Questions, item)
	}
	answers, err := q.ListTrainingAnswers(ctx, store.ListTrainingAnswersParams{FamilyID: row.FamilyID, MemberID: row.MemberID, RoundID: row.ID})
	if err != nil {
		return Round{}, err
	}
	for _, answer := range answers {
		out.Answers[answer.QuestionID] = answer
	}
	if row.CompletedAt.Valid {
		history, err := q.ListTrainingHistory(ctx, store.ListTrainingHistoryParams{FamilyID: row.FamilyID, MemberID: row.MemberID})
		if err != nil {
			return Round{}, err
		}
		out.Scores = scores(history)
	}
	return out, nil
}

func GetProgress(ctx context.Context, pool *pgxpool.Pool, familyID, memberID uuid.UUID) (out Progress, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		history, err := q.ListTrainingHistory(ctx, store.ListTrainingHistoryParams{FamilyID: familyID, MemberID: memberID})
		if err != nil {
			return err
		}
		count, err := q.CountTrainingRounds(ctx, store.CountTrainingRoundsParams{FamilyID: familyID, MemberID: memberID})
		if err != nil {
			return err
		}
		out = Progress{Scores: scores(history), Completed: int(count)}
		return access.Audit(ctx, q, familyID, memberID, access.ActionRead, "simulator_round", "")
	})
	return out, err
}

func CreateRound(ctx context.Context, pool *pgxpool.Pool, familyID, memberID uuid.UUID, mode string, scenarioID *string, now time.Time) (out Round, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var ids []string
		switch mode {
		case "scenario":
			if scenarioID == nil || strings.TrimSpace(*scenarioID) == "" {
				return ErrInvalid
			}
			scenario, ok := Scenario(*scenarioID)
			if !ok {
				return pgx.ErrNoRows
			}
			ids = scenario.Questions
		case "practice":
			scenarioID = nil
			history, err := q.ListTrainingHistory(ctx, store.ListTrainingHistoryParams{FamilyID: familyID, MemberID: memberID})
			if err != nil {
				return err
			}
			ids = practiceIDs(history)
			if len(ids) == 0 {
				return ErrNothingToPractice
			}
		default:
			return ErrInvalid
		}
		row, err := q.CreateTrainingRound(ctx, store.CreateTrainingRoundParams{FamilyID: familyID, MemberID: memberID, Mode: mode, ScenarioID: scenarioID, QuestionIds: ids, CreatedAt: now})
		if err != nil {
			return err
		}
		out, err = loadRound(ctx, q, row)
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, memberID, access.ActionCreate, "simulator_round", row.ID.String())
	})
	return out, err
}

func GetRound(ctx context.Context, pool *pgxpool.Pool, familyID, memberID, id uuid.UUID) (out Round, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.LockTrainingRound(ctx, store.LockTrainingRoundParams{FamilyID: familyID, MemberID: memberID, ID: id})
		if err != nil {
			return err
		}
		out, err = loadRound(ctx, q, row)
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, memberID, access.ActionRead, "simulator_round", id.String())
	})
	return out, err
}

func Answer(ctx context.Context, pool *pgxpool.Pool, familyID, memberID, id uuid.UUID, questionID, choiceID string, now time.Time) (question content.PracticeQuestion, completed bool, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.LockTrainingRound(ctx, store.LockTrainingRoundParams{FamilyID: familyID, MemberID: memberID, ID: id})
		if err != nil {
			return err
		}
		if !slices.Contains(row.QuestionIds, questionID) {
			return ErrInvalid
		}
		catalog := content.PracticeQuestions()
		index := slices.IndexFunc(catalog, func(item content.PracticeQuestion) bool { return item.ID == questionID })
		if index < 0 {
			return ErrInvalid
		}
		question = catalog[index]
		if !slices.ContainsFunc(question.Choices, func(choice content.PracticeChoice) bool { return choice.ID == choiceID }) {
			return ErrInvalid
		}
		answers, err := q.ListTrainingAnswers(ctx, store.ListTrainingAnswersParams{FamilyID: familyID, MemberID: memberID, RoundID: id})
		if err != nil {
			return err
		}
		if slices.ContainsFunc(answers, func(answer store.SimulatorAnswer) bool { return answer.QuestionID == questionID }) {
			return ErrAlreadyAnswered
		}
		err = q.InsertTrainingAnswer(ctx, store.InsertTrainingAnswerParams{FamilyID: familyID, MemberID: memberID, RoundID: id, QuestionID: questionID, ChoiceID: choiceID, Skill: question.Skill, Correct: choiceID == question.CorrectChoice, AnsweredAt: now})
		if err != nil {
			return err
		}
		completed = len(answers)+1 == len(row.QuestionIds)
		if completed {
			err = q.CompleteTrainingRound(ctx, store.CompleteTrainingRoundParams{FamilyID: familyID, MemberID: memberID, ID: id, CompletedAt: pgtype.Timestamptz{Time: now, Valid: true}})
			if err != nil {
				return err
			}
		}
		return access.Audit(ctx, q, familyID, memberID, access.ActionUpdate, "simulator_round", id.String())
	})
	return question, completed, err
}
