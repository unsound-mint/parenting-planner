package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/screening"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var errScreeningAnswers = Error{Code: "invalid_request", Message: "answer every question of the questionnaire once, in order, with one of its printed scores"}

// isParent: questionnaires are for the mother and the partner. Members are
// parents only today; a grandparent or nanny id gets 404 once they exist.
func isParent(m store.Member) bool {
	return m.Role == string(ParentRoleMother) || m.Role == string(ParentRolePartner)
}

func (s *Server) ListScreeningQuestionnaires(ctx context.Context, req ListScreeningQuestionnairesRequestObject) (ListScreeningQuestionnairesResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListScreeningQuestionnaires401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return ListScreeningQuestionnaires404JSONResponse(errNoMember), nil
	}
	qs, err := screening.Questionnaires(ctx, s.pool, familyID, req.MemberId, s.today(ctx), s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := ScreeningQuestionnaireList{Items: make([]ScreeningQuestionnaire, 0, len(qs))}
	for _, q := range qs {
		out.Items = append(out.Items, questionnaireOut(q))
	}
	return ListScreeningQuestionnaires200JSONResponse(out), nil
}

func (s *Server) CreateMoodScreening(ctx context.Context, req CreateMoodScreeningRequestObject) (CreateMoodScreeningResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateMoodScreening401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return CreateMoodScreening404JSONResponse(errNoMember), nil
	}
	b := req.Body
	r, err := screening.Create(ctx, s.pool, familyID, req.MemberId, screening.NewMoodScreening{
		Instrument: string(b.Instrument), Answers: b.Answers,
		Visibility: access.Visibility(b.Visibility), TakenAt: s.now(ctx),
	})
	if errors.Is(err, screening.ErrAnswers) {
		return CreateMoodScreening400JSONResponse(errScreeningAnswers), nil
	}
	if err != nil {
		return nil, err
	}
	return CreateMoodScreening201JSONResponse(moodScreeningOut(r)), nil
}

func (s *Server) ListMoodScreenings(ctx context.Context, req ListMoodScreeningsRequestObject) (ListMoodScreeningsResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListMoodScreenings401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return ListMoodScreenings404JSONResponse(errNoMember), nil
	}
	rows, err := screening.List(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := MoodScreeningList{Items: make([]MoodScreeningResult, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, moodScreeningOut(r))
	}
	return ListMoodScreenings200JSONResponse(out), nil
}

func ruleSourceOut(s rules.Source) Source {
	return Source{Title: s.Title, Url: s.URL, CheckedAt: openapi_types.Date{Time: s.CheckedAt}}
}

func moodScreeningOut(r screening.Result) MoodScreeningResult {
	out := MoodScreeningResult{
		Id: r.ID, AuthorId: r.OwnerMemberID, Instrument: ScreeningInstrument(r.Instrument), TakenAt: r.TakenAt.UTC(),
		Score: int(r.Score), MaxScore: r.MaxScore, Band: ScreeningBand(r.Band), Urgent: r.Urgent,
		Source: ruleSourceOut(r.Source), Visibility: Visibility(r.Visibility),
	}
	if r.Own {
		msg := r.Message
		out.Message = &msg
	}
	return out
}

func questionnaireOut(q screening.Questionnaire) ScreeningQuestionnaire {
	out := ScreeningQuestionnaire{
		Instrument: ScreeningInstrument(q.ID), Title: q.Title, Intro: q.Intro, Suggested: q.Suggested,
		Source: ruleSourceOut(q.Source), Questions: make([]ScreeningQuestion, 0, len(q.Questions)),
	}
	for i, qu := range q.Questions {
		choices := make([]ScreeningChoice, 0, len(qu.Choices))
		for _, c := range qu.Choices {
			choices = append(choices, ScreeningChoice{Value: c.Value, Label: c.Label})
		}
		out.Questions = append(out.Questions, ScreeningQuestion{Number: i + 1, Text: qu.Text, Choices: choices})
	}
	return out
}
