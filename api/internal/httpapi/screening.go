package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/screening"
)

var errScreeningAnswers = Error{Code: "invalid_request", Message: "answer every question of the questionnaire once, in order, with one of its printed scores"}

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

var errScreeningVisibility = Error{Code: "invalid_request", Message: "a result can only be private or shared with the partner"}
var errNoScreening = Error{Code: "not_found", Message: "no such result"}

// UpdateMoodScreening lets the author share a result with the partner or take it back.
func (s *Server) UpdateMoodScreening(ctx context.Context, req UpdateMoodScreeningRequestObject) (UpdateMoodScreeningResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateMoodScreening401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return UpdateMoodScreening404JSONResponse(errNoMember), nil
	}
	r, err := screening.Share(ctx, s.pool, familyID, req.MemberId, req.ScreeningId, access.Visibility(req.Body.Visibility))
	switch {
	case errors.Is(err, screening.ErrVisibility):
		return UpdateMoodScreening400JSONResponse(errScreeningVisibility), nil
	case errors.Is(err, screening.ErrNoResult):
		return UpdateMoodScreening404JSONResponse(errNoScreening), nil
	case err != nil:
		return nil, err
	}
	return UpdateMoodScreening200JSONResponse(moodScreeningOut(r)), nil
}

func draftOut(d screening.Draft) MoodScreeningDraft {
	return MoodScreeningDraft{Instrument: ScreeningInstrument(d.Instrument), Answers: d.Answers, UpdatedAt: d.UpdatedAt.UTC()}
}

func (s *Server) ListMoodScreeningDrafts(ctx context.Context, req ListMoodScreeningDraftsRequestObject) (ListMoodScreeningDraftsResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListMoodScreeningDrafts401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return ListMoodScreeningDrafts404JSONResponse(errNoMember), nil
	}
	rows, err := screening.ListDrafts(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := MoodScreeningDraftList{Items: make([]MoodScreeningDraft, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, draftOut(r))
	}
	return ListMoodScreeningDrafts200JSONResponse(out), nil
}

func (s *Server) SaveMoodScreeningDraft(ctx context.Context, req SaveMoodScreeningDraftRequestObject) (SaveMoodScreeningDraftResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SaveMoodScreeningDraft401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return SaveMoodScreeningDraft404JSONResponse(errNoMember), nil
	}
	d, err := screening.SaveDraft(ctx, s.pool, familyID, req.MemberId, string(req.Instrument), req.Body.Answers, s.now(ctx))
	if errors.Is(err, screening.ErrAnswers) {
		return SaveMoodScreeningDraft400JSONResponse(errScreeningAnswers), nil
	}
	if err != nil {
		return nil, err
	}
	return SaveMoodScreeningDraft200JSONResponse(draftOut(d)), nil
}

func (s *Server) DeleteMoodScreeningDraft(ctx context.Context, req DeleteMoodScreeningDraftRequestObject) (DeleteMoodScreeningDraftResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteMoodScreeningDraft401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return DeleteMoodScreeningDraft404JSONResponse(errNoMember), nil
	}
	if err := screening.DeleteDraft(ctx, s.pool, familyID, req.MemberId, string(req.Instrument)); err != nil {
		return nil, err
	}
	return DeleteMoodScreeningDraft204Response{}, nil
}
