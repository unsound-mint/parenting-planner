package httpapi

import (
	"context"
	"slices"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

// The US family paperwork hub is parents only: actingMember answers 404 for a
// caregiver. The checklist is the family's paperwork tasks (shared by both
// parents, ticked with updateTask), so there is no table of its own and no
// visibility column. Benefit answers are used for one response and never stored.

var errUnknownBenefitQuestion = Error{Code: "invalid_request", Message: "unknown question id"}

func srcOut(s content.Source) Source {
	return Source{Title: s.Title, Url: s.URL, CheckedAt: openapi_types.Date{Time: s.CheckedAt}}
}

func srcsOut(in []content.Source) []Source {
	out := make([]Source, 0, len(in))
	for _, s := range in {
		out = append(out, srcOut(s))
	}
	return out
}

func (s *Server) GetFamilyPaperwork(ctx context.Context, req GetFamilyPaperworkRequestObject) (GetFamilyPaperworkResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetFamilyPaperwork401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetFamilyPaperwork404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	paperwork := "paperwork"
	rows, err := tasks.List(ctx, s.pool, familyID, &paperwork)
	if err != nil {
		return nil, err
	}
	a, _, err := tasks.LoadAnchors(ctx, s.q, familyID)
	if err != nil {
		return nil, err
	}
	hub := content.Hub()
	out := FamilyPaperwork{
		Today: openapi_types.Date{Time: s.today(ctx)}, Phase: FamilyPaperworkPhase(content.PhaseOf(st.Stage)),
		Items: make([]PaperworkItem, 0, len(rows)), Rights: make([]RightsCard, 0, len(hub.Rights)),
		StatePointer: StateLeavePointer{Title: hub.State.Title, Text: hub.State.Text, Source: srcOut(hub.State.Source)},
	}
	switch {
	case a.BirthDate != nil:
		k := TaskDueAnchor("birth_date")
		out.AnchorKind, out.AnchorOn = &k, &openapi_types.Date{Time: *a.BirthDate}
	case a.DueDate != nil:
		k := TaskDueAnchor("due_date")
		out.AnchorKind, out.AnchorOn = &k, &openapi_types.Date{Time: *a.DueDate}
	}
	for _, it := range rows {
		if it.CatalogKey == nil {
			continue
		}
		p, ok := content.PaperworkByKey(*it.CatalogKey)
		if !ok {
			continue
		}
		out.Items = append(out.Items, PaperworkItem{
			Key: p.Key, Task: taskOut(it), Why: p.Why, How: p.How, Basis: PaperworkItemBasis(p.Basis), MoreSources: srcsOut(p.More),
		})
	}
	for _, r := range hub.Rights {
		out.Rights = append(out.Rights, RightsCard{
			Id: r.ID, Title: r.Title, Law: r.Law, Covers: r.Covers, Ask: r.Ask, HowToAsk: r.HowToAsk,
			Note: RightsNote{Subject: r.Note.Subject, Body: r.Note.Body}, Source: srcOut(r.Source),
		})
	}
	b := BenefitsFinder{
		Questions: make([]BenefitQuestion, 0, len(hub.Questions)), Programs: make([]BenefitProgram, 0, len(hub.Programs)),
		Household: householdHasYoungChild(st), FinderText: hub.Finder.Text, FinderSource: srcOut(hub.Finder.Source),
	}
	for _, q := range hub.Questions {
		b.Questions = append(b.Questions, BenefitQuestion{Id: q.ID, Text: q.Text})
	}
	for _, p := range hub.Programs {
		if p.NeedsHousehold && !b.Household {
			continue
		}
		b.Programs = append(b.Programs, BenefitProgram{Id: p.ID, Name: p.Name, What: p.What, Where: p.Where, Source: srcOut(p.Source), MoreSources: srcsOut(p.More)})
	}
	out.Benefits = b
	return GetFamilyPaperwork200JSONResponse(out), nil
}

// householdHasYoungChild is true for a pregnancy or a youngest child under 5.
func householdHasYoungChild(st content.State) bool {
	return st.Stage == "pregnancy" || (st.HasChild && st.AgeMonths < 60)
}

func (s *Server) CheckBenefits(ctx context.Context, req CheckBenefitsRequestObject) (CheckBenefitsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CheckBenefits401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CheckBenefits404JSONResponse(errNoMember), nil
	}
	hub := content.Hub()
	known := make([]string, 0, len(hub.Questions))
	for _, q := range hub.Questions {
		known = append(known, q.ID)
	}
	for id := range req.Body.Answers {
		if !slices.Contains(known, id) {
			return CheckBenefits400JSONResponse(errUnknownBenefitQuestion), nil
		}
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	hl := hub.Highlighted(req.Body.Answers, householdHasYoungChild(st))
	out := BenefitHighlights{Items: []BenefitHighlight{}}
	for _, p := range hub.Programs { // catalog order keeps the list stable
		if reason, ok := hl[p.ID]; ok {
			out.Items = append(out.Items, BenefitHighlight{ProgramId: p.ID, Reason: reason})
		}
	}
	return CheckBenefits200JSONResponse(out), nil
}
