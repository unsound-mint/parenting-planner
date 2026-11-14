package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
)

func (s *Server) GetMemberPlan(ctx context.Context, req GetMemberPlanRequestObject) (GetMemberPlanResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetMemberPlan401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetMemberPlan404JSONResponse(errNoMember), nil
	}
	items, err := plan.ForMember(ctx, s.q, familyID, req.MemberId, s.today(), s.cfg.Now())
	if err != nil {
		return nil, err
	}
	out := Plan{MemberId: req.MemberId, GeneratedAt: s.cfg.Now().UTC(), Items: make([]PlanItem, 0, len(items))}
	for _, it := range items {
		pi := PlanItem{
			RuleId: it.RuleID, Title: it.Title, Detail: it.Detail, Reason: it.Reason,
			Status: PlanItemStatus(it.Status), Category: PlanCategory(it.Category),
			Source: Source{Title: it.Source.Title, Url: it.Source.URL, CheckedAt: openapi_types.Date{Time: it.Source.CheckedAt}},
		}
		if it.DueBy != nil {
			pi.DueBy = &openapi_types.Date{Time: *it.DueBy}
		}
		out.Items = append(out.Items, pi)
	}
	return GetMemberPlan200JSONResponse(out), nil
}

// GetMemberWeeklyPlan is a stub until the AI weekly plan lands (#171). The web
// screen treats this as "no AI plan" and shows the rule plan alone.
func (s *Server) GetMemberWeeklyPlan(_ context.Context, _ GetMemberWeeklyPlanRequestObject) (GetMemberWeeklyPlanResponseObject, error) {
	return GetMemberWeeklyPlan501JSONResponse(Error{Code: "not_implemented", Message: "the weekly plan is not built yet"}), nil
}
