// Package learn owns learning paths: each parent's reading state and quiz
// answers over the embedded catalog (internal/content). Reading progress and
// answers are shared between the two parents by design, so they are not
// sensitive records and carry no visibility; caregivers never reach them
// (the handlers are parents only).
package learn

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrUnknownLesson   = errors.New("unknown lesson")
	ErrLocked          = errors.New("lesson locked")
	ErrUnknownQuestion = errors.New("unknown question")
	ErrUnknownChoice   = errors.New("unknown choice")
	ErrAlreadyAnswered = errors.New("already answered")
)

// Couple is the acting parent and the other parent (uuid.Nil when the family
// has only one).
type Couple struct{ Me, Other uuid.UUID }

// Read is one parent's reading state for a lesson.
type Read struct {
	MemberID   uuid.UUID
	LessonID   string
	StartedAt  time.Time
	FinishedAt *time.Time
}

// Answer is one parent's quiz answer as the acting parent may see it. Choice
// is empty and Correct nil for the other parent until the acting parent has
// answered the same question.
type Answer struct {
	MemberID   uuid.UUID
	ChoiceID   string
	Correct    *bool
	AnsweredAt time.Time
}

// QuestionView is a quiz question for the acting parent. Revealed is true once
// they answered; only then do the right choice and the explanation show.
type QuestionView struct {
	content.Question
	Answers  []Answer
	Revealed bool
}

type LessonView struct {
	content.Lesson
	State content.LessonState
	Reads []Read
	Quiz  []QuestionView
}

type Progress struct {
	MemberID          uuid.UUID
	Started, Finished int
}

type PathView struct {
	content.LearnPath
	Lessons  []LessonView
	Progress []Progress
}

// Paths returns the stage's paths with both parents' reading state and quiz
// answers, acting parent first.
func Paths(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, c Couple, st content.State) ([]PathView, error) {
	q := store.New(pool)
	readRows, err := q.ListLessonReads(ctx, familyID)
	if err != nil {
		return nil, err
	}
	answerRows, err := q.ListQuizAnswers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	reads := map[uuid.UUID]map[string]Read{}
	for _, r := range readRows {
		if reads[r.MemberID] == nil {
			reads[r.MemberID] = map[string]Read{}
		}
		reads[r.MemberID][r.LessonID] = readOut(r)
	}
	answers := map[uuid.UUID]map[string]store.QuizAnswer{}
	for _, a := range answerRows {
		if answers[a.MemberID] == nil {
			answers[a.MemberID] = map[string]store.QuizAnswer{}
		}
		answers[a.MemberID][a.QuestionID] = a
	}
	people := []uuid.UUID{c.Me}
	if c.Other != uuid.Nil {
		people = append(people, c.Other)
	}

	out := []PathView{}
	for _, p := range content.LearnPathsFor(st) {
		pv := PathView{LearnPath: p, Lessons: make([]LessonView, 0, len(p.Lessons))}
		progress := make([]Progress, len(people))
		for i, m := range people {
			progress[i].MemberID = m
		}
		for _, l := range p.Lessons {
			lv := LessonView{Lesson: l, State: l.StateOf(st), Reads: []Read{}, Quiz: make([]QuestionView, 0, len(l.Quiz))}
			for i, m := range people {
				if r, ok := reads[m][l.ID]; ok {
					lv.Reads = append(lv.Reads, r)
					if r.FinishedAt != nil {
						progress[i].Finished++
					} else {
						progress[i].Started++
					}
				}
			}
			for _, question := range l.Quiz {
				lv.Quiz = append(lv.Quiz, questionView(question, c, answers))
			}
			pv.Lessons = append(pv.Lessons, lv)
		}
		pv.Progress = progress
		out = append(out, pv)
	}
	return out, nil
}

// questionView applies the reveal rule: the other parent's choice, the right
// choice and the explanation show only after the acting parent answered, so
// "Jake answered" never gives the answer away.
func questionView(question content.Question, c Couple, answers map[uuid.UUID]map[string]store.QuizAnswer) QuestionView {
	v := QuestionView{Question: question, Answers: []Answer{}}
	mine, answered := answers[c.Me][question.ID]
	if answered {
		v.Revealed = true
		v.Answers = append(v.Answers, answerOut(mine, question))
	}
	if c.Other != uuid.Nil {
		if theirs, ok := answers[c.Other][question.ID]; ok {
			a := Answer{MemberID: theirs.MemberID, AnsweredAt: theirs.AnsweredAt}
			if answered {
				a = answerOut(theirs, question)
			}
			v.Answers = append(v.Answers, a)
		}
	}
	return v
}

func answerOut(a store.QuizAnswer, question content.Question) Answer {
	right := a.ChoiceID == question.CorrectChoiceID
	return Answer{MemberID: a.MemberID, ChoiceID: a.ChoiceID, Correct: &right, AnsweredAt: a.AnsweredAt}
}

func readOut(r store.LessonRead) Read {
	out := Read{MemberID: r.MemberID, LessonID: r.LessonID, StartedAt: r.StartedAt}
	if r.FinishedAt.Valid {
		t := r.FinishedAt.Time
		out.FinishedAt = &t
	}
	return out
}

// UpdateRead starts a lesson for the acting parent, or finishes it, or (with
// finished false) takes the finish back.
func UpdateRead(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, st content.State, lessonID string, finished bool, now time.Time) (Read, error) {
	l, ok := content.LessonFor(st, lessonID)
	if !ok {
		return Read{}, ErrUnknownLesson
	}
	if l.StateOf(st).Locked {
		return Read{}, ErrLocked
	}
	r, err := store.New(pool).StartLessonRead(ctx, store.StartLessonReadParams{
		FamilyID: familyID, MemberID: actor, LessonID: l.ID, At: now, Finished: finished,
	})
	if err != nil {
		return Read{}, err
	}
	return readOut(r), nil
}

// Result is what the acting parent learns after answering.
type Result struct {
	Answer
	QuestionID      string
	CorrectChoiceID string
	Explanation     string
	Source          content.Source
	Partner         *Answer
}

// AnswerQuestion stores the acting parent's one answer to a question.
func AnswerQuestion(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, c Couple, st content.State, questionID, choiceID string, now time.Time) (Result, error) {
	question, lesson, ok := content.QuestionFor(st, questionID)
	if !ok {
		return Result{}, ErrUnknownQuestion
	}
	if lesson.StateOf(st).Locked {
		return Result{}, ErrLocked
	}
	known := false
	for _, ch := range question.Choices {
		known = known || ch.ID == choiceID
	}
	if !known {
		return Result{}, ErrUnknownChoice
	}
	var out Result
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		a, err := q.CreateQuizAnswer(ctx, store.CreateQuizAnswerParams{
			FamilyID: familyID, MemberID: c.Me, QuestionID: question.ID, ChoiceID: choiceID, AnsweredAt: now,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrAlreadyAnswered
		}
		if err != nil {
			return err
		}
		out = Result{
			Answer: answerOut(a, question), QuestionID: question.ID, CorrectChoiceID: question.CorrectChoiceID,
			Explanation: question.Explanation, Source: question.Source,
		}
		if c.Other == uuid.Nil {
			return nil
		}
		theirs, err := q.GetQuizAnswer(ctx, store.GetQuizAnswerParams{FamilyID: familyID, MemberID: c.Other, QuestionID: question.ID})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		p := answerOut(theirs, question)
		out.Partner = &p
		return nil
	})
	return out, err
}
