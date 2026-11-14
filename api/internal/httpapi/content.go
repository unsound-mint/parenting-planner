package httpapi

import (
	"context"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
)

var errNotPregnant = Error{Code: "not_pregnant", Message: "the family is not pregnant"}

func (s *Server) ListGuides(ctx context.Context, req ListGuidesRequestObject) (ListGuidesResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListGuides401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListGuides404JSONResponse(errNoMember), nil
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var want content.Kind
	if req.Params.Kind != nil {
		want = content.Kind(*req.Params.Kind)
	}
	entries := content.Guides(state, content.Viewer{Role: m.Role}, want)
	out := GuideList{Items: make([]Guide, 0, len(entries))}
	for _, e := range entries {
		out.Items = append(out.Items, guideOut(e))
	}
	return ListGuides200JSONResponse(out), nil
}

func (s *Server) GetPregnancyWeek(ctx context.Context, req GetPregnancyWeekRequestObject) (GetPregnancyWeekResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetPregnancyWeek401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetPregnancyWeek404JSONResponse(errNoMember), nil
	}
	viewer := content.Viewer{Role: m.Role}
	if !viewer.MayReadPregnancy() {
		return GetPregnancyWeek403JSONResponse(errForbidden), nil
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	if state.Stage != "pregnancy" || !state.HasWeek {
		return GetPregnancyWeek409JSONResponse(errNotPregnant), nil
	}
	card, ok := content.WeekCard(req.Week, viewer, state.Week)
	if !ok {
		// The contract limits week to 4..40, so this is unreachable.
		return GetPregnancyWeek400JSONResponse(Error{Code: "invalid_request", Message: "week must be 4 to 40"}), nil
	}
	out := PregnancyWeek{
		Week: card.Week, IsCurrentWeek: card.Week == state.Week, WhyItMatters: card.WhyItMatters,
		Tasks: card.Tasks, Questions: card.Questions, BirthPrep: make([]Guide, 0, len(card.BirthPrep)),
		Source: sourceOut(card.Source),
	}
	for _, e := range card.BirthPrep {
		out.BirthPrep = append(out.BirthPrep, guideOut(e))
	}
	return GetPregnancyWeek200JSONResponse(out), nil
}

// contentState reads the family's stage, gestational week and youngest child's age.
func (s *Server) contentState(ctx context.Context, familyID uuid.UUID) (content.State, bool, error) {
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return content.State{}, false, err
	}
	kids, err := s.q.ListChildren(ctx, familyID)
	if err != nil {
		return content.State{}, false, err
	}
	today := s.today()
	st := content.State{Stage: fam.Stage}
	st.Week, st.HasWeek = rules.Facts{Today: today, Stage: fam.Stage, DueDate: fam.DueDate}.GestationalWeek()
	if n := len(kids); n > 0 {
		// ListChildren is oldest first; the youngest decides the content.
		st.HasChild, st.AgeMonths = true, monthsBetween(kids[n-1].BirthDate, today)
	}
	return st, true, nil
}

func sourceOut(s content.Source) Source {
	return Source{Title: s.Title, Url: s.URL, CheckedAt: openapi_types.Date{Time: s.CheckedAt}}
}

func guideOut(e content.Entry) Guide {
	g := Guide{
		Id: e.ID, Kind: GuideKind(e.Kind), Title: e.Title, Summary: e.Summary, Steps: e.Steps,
		Stages: make([]Stage, 0, len(e.Stages)), Audience: make([]GuideAudience, 0, len(e.Audience)),
		Locked: e.Locked, Source: sourceOut(e.Source),
	}
	if e.Minutes > 0 {
		g.Minutes = &e.Minutes
	}
	for _, st := range e.Stages {
		g.Stages = append(g.Stages, Stage(st))
	}
	for _, a := range e.Audience {
		g.Audience = append(g.Audience, GuideAudience(a))
	}
	if e.Weeks != nil {
		g.WeekFrom, g.WeekTo = &e.Weeks.From, &e.Weeks.To
	}
	if e.Ages != nil {
		g.AgeMonthsFrom, g.AgeMonthsTo = &e.Ages.From, &e.Ages.To
	}
	if e.Kind == content.BirthPrep {
		unlock := content.BirthPrepUnlockWeek
		g.UnlocksAtWeek = &unlock
	}
	return g
}
