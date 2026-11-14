package httpapi

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/simulator"
)

func (s *Server) GetSimulatorProgress(ctx context.Context, req GetSimulatorProgressRequestObject) (GetSimulatorProgressResponseObject, error) {
	familyID, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetSimulatorProgress401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetSimulatorProgress404JSONResponse(errNoMember), nil
	}
	progress, err := simulator.GetProgress(ctx, s.pool, familyID, member.ID)
	if err != nil {
		return nil, err
	}
	scenarios := content.PracticeScenarios()
	catalog := content.PracticeQuestions()
	out := SimulatorProgress{MemberId: member.ID, Skills: trainingScores(progress.Scores), WeakSpots: trainingWeak(progress.Scores), RoundsCompleted: progress.Completed, Scenarios: make([]SimulatorScenario, 0, len(scenarios))}
	for _, scenario := range scenarios {
		item := SimulatorScenario{Id: scenario.ID, Title: scenario.Title, Summary: scenario.Summary, QuestionCount: len(scenario.Questions), SuggestedShift: trainingShift(scenario.Shift)}
		for _, id := range scenario.Questions {
			for _, question := range catalog {
				if question.ID == id {
					item.Skills = append(item.Skills, SimulatorSkill(question.Skill))
					break
				}
			}
		}
		out.Scenarios = append(out.Scenarios, item)
	}
	return GetSimulatorProgress200JSONResponse(out), nil
}

func (s *Server) CreateSimulatorRound(ctx context.Context, req CreateSimulatorRoundRequestObject) (CreateSimulatorRoundResponseObject, error) {
	familyID, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateSimulatorRound401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateSimulatorRound404JSONResponse(errNoMember), nil
	}
	round, err := simulator.CreateRound(ctx, s.pool, familyID, member.ID, string(req.Body.Mode), req.Body.ScenarioId, s.now(ctx))
	switch {
	case errors.Is(err, simulator.ErrInvalid):
		return CreateSimulatorRound400JSONResponse(Error{Code: "invalid_round", Message: "Choose a scenario to start a scenario round."}), nil
	case errors.Is(err, pgx.ErrNoRows):
		return CreateSimulatorRound404JSONResponse(Error{Code: "not_found", Message: "No such scenario."}), nil
	case errors.Is(err, simulator.ErrNothingToPractice):
		return CreateSimulatorRound409JSONResponse(Error{Code: "nothing_to_practice", Message: "Answer a scenario question before starting practice."}), nil
	case err != nil:
		return nil, err
	}
	return CreateSimulatorRound201JSONResponse(trainingRound(round)), nil
}

func (s *Server) GetSimulatorRound(ctx context.Context, req GetSimulatorRoundRequestObject) (GetSimulatorRoundResponseObject, error) {
	familyID, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetSimulatorRound401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetSimulatorRound404JSONResponse(errNoMember), nil
	}
	round, err := simulator.GetRound(ctx, s.pool, familyID, member.ID, req.RoundId)
	if errors.Is(err, pgx.ErrNoRows) {
		return GetSimulatorRound404JSONResponse(trainingRoundNotFound), nil
	}
	if err != nil {
		return nil, err
	}
	return GetSimulatorRound200JSONResponse(trainingRound(round)), nil
}

var trainingRoundNotFound = Error{Code: "not_found", Message: "No such round for this member."}

func (s *Server) CreateSimulatorAnswer(ctx context.Context, req CreateSimulatorAnswerRequestObject) (CreateSimulatorAnswerResponseObject, error) {
	familyID, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateSimulatorAnswer401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateSimulatorAnswer404JSONResponse(errNoMember), nil
	}
	question, completed, err := simulator.Answer(ctx, s.pool, familyID, member.ID, req.RoundId, req.Body.QuestionId, req.Body.ChoiceId, s.now(ctx))
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return CreateSimulatorAnswer404JSONResponse(trainingRoundNotFound), nil
	case errors.Is(err, simulator.ErrInvalid):
		return CreateSimulatorAnswer400JSONResponse(Error{Code: "invalid_answer", Message: "Choose an answer from a question in this round."}), nil
	case errors.Is(err, simulator.ErrAlreadyAnswered):
		return CreateSimulatorAnswer409JSONResponse(Error{Code: "already_answered", Message: "This question already has an answer."}), nil
	case err != nil:
		return nil, err
	}
	out := trainingAnswer(question, req.Body.ChoiceId)
	out.RoundCompleted = &completed
	return CreateSimulatorAnswer201JSONResponse(out), nil
}

func trainingAnswer(q content.PracticeQuestion, choice string) SimulatorAnswerResult {
	out := SimulatorAnswerResult{QuestionId: q.ID, ChoiceId: choice, Correct: choice == q.CorrectChoice, CorrectChoiceId: q.CorrectChoice, Explanation: q.Explanation, Skill: SimulatorSkill(q.Skill)}
	if q.Source != nil {
		source := sourceOut(*q.Source)
		out.Source = &source
	}
	return out
}

func trainingShift(s content.PracticeShift) *ShiftSuggestion {
	out := &ShiftSuggestion{Title: s.Title, StartTime: s.Start, EndTime: s.End, Days: make([]Weekday, 0, len(s.Days))}
	for _, day := range s.Days {
		out.Days = append(out.Days, Weekday(day))
	}
	return out
}

func trainingScores(scores []simulator.Score) []SkillScore {
	out := make([]SkillScore, 0, len(scores))
	for _, score := range scores {
		out = append(out, SkillScore{Skill: SimulatorSkill(score.Skill), Answered: score.Answered, Correct: score.Correct, Score: score.Percent, Weak: score.Weak})
	}
	return out
}

func trainingWeak(scores []simulator.Score) []SimulatorSkill {
	skills := simulator.WeakSpots(scores)
	out := make([]SimulatorSkill, 0, len(skills))
	for _, skill := range skills {
		out = append(out, SimulatorSkill(skill))
	}
	return out
}

func trainingRound(round simulator.Round) SimulatorRound {
	row := round.Row
	out := SimulatorRound{Id: row.ID, Mode: SimulatorMode(row.Mode), CreatedAt: row.CreatedAt.UTC(), ScenarioId: row.ScenarioID, Title: "Practice round", Completed: row.CompletedAt.Valid, Questions: make([]SimulatorQuestion, 0, len(round.Questions))}
	var shift *ShiftSuggestion
	if row.ScenarioID != nil {
		if sc, ok := simulator.Scenario(*row.ScenarioID); ok {
			out.Title = sc.Title
			shift = trainingShift(sc.Shift)
		}
	}
	correct := 0
	for _, q := range round.Questions {
		item := SimulatorQuestion{Id: q.ID, Prompt: q.Prompt, Skill: SimulatorSkill(q.Skill), Choices: make([]SimulatorChoice, 0, len(q.Choices))}
		for _, c := range q.Choices {
			item.Choices = append(item.Choices, SimulatorChoice{Id: c.ID, Text: c.Text})
		}
		if a, ok := round.Answers[q.ID]; ok {
			response := trainingAnswer(q, a.ChoiceID)
			response.Correct = a.Correct
			item.Answer = &response
			if a.Correct {
				correct++
			}
		}
		out.Questions = append(out.Questions, item)
	}
	if out.Completed {
		out.Result = &SimulatorRoundResult{Correct: correct, Total: len(out.Questions), Skills: trainingScores(round.Scores), WeakSpots: trainingWeak(round.Scores), SuggestedShift: shift}
	}
	return out
}
