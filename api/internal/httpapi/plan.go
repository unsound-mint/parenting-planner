package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/notify"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
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
	items, err := plan.ForMember(ctx, s.q, familyID, req.MemberId, s.today(ctx), s.now(ctx))
	if err != nil {
		return nil, err
	}
	// Reading the plan is when plan_item_due notifications are written.
	if err := notify.PlanItemsDue(ctx, s.pool, familyID, req.MemberId, items, s.today(ctx), s.now(ctx)); err != nil {
		return nil, err
	}
	out := Plan{MemberId: req.MemberId, GeneratedAt: s.now(ctx).UTC(), Items: make([]PlanItem, 0, len(items))}
	for _, it := range items {
		out.Items = append(out.Items, planItemOut(it))
	}
	return GetMemberPlan200JSONResponse(out), nil
}

// planItemOut is shared with the journey timeline, which shows the head of
// the same plan.
func planItemOut(it rules.Item) PlanItem {
	pi := PlanItem{
		RuleId: it.RuleID, Title: it.Title, Detail: it.Detail, Reason: it.Reason,
		Status: PlanItemStatus(it.Status), Category: PlanCategory(it.Category),
		Source: Source{Title: it.Source.Title, Url: it.Source.URL, CheckedAt: openapi_types.Date{Time: it.Source.CheckedAt}},
	}
	if it.DueBy != nil {
		pi.DueBy = &openapi_types.Date{Time: *it.DueBy}
	}
	if it.Progress != "" {
		p := PlanItemProgress(it.Progress)
		pi.Progress = &p
	}
	return pi
}

// GetMemberWeeklyPlan is a stub until the AI weekly plan lands (#171). The web
// screen treats this as "no AI plan" and shows the rule plan alone.
func (s *Server) GetMemberWeeklyPlan(_ context.Context, _ GetMemberWeeklyPlanRequestObject) (GetMemberWeeklyPlanResponseObject, error) {
	return GetMemberWeeklyPlan501JSONResponse(Error{Code: "not_implemented", Message: "the weekly plan is not built yet"}), nil
}

// SetPlanItemProgress records the acting parent's progress on an item of their
// own plan. The other parent's plan is not affected.
func (s *Server) SetPlanItemProgress(ctx context.Context, req SetPlanItemProgressRequestObject) (SetPlanItemProgressResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SetPlanItemProgress401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SetPlanItemProgress404JSONResponse(errNoMember), nil
	}
	it, err := plan.SetProgress(ctx, s.pool, familyID, req.MemberId, req.RuleId, string(req.Body.Status), s.today(ctx), s.now(ctx))
	switch {
	case errors.Is(err, plan.ErrNotOnPlan):
		return SetPlanItemProgress404JSONResponse(errNoPlanItem), nil
	case err != nil:
		return nil, err
	}
	return SetPlanItemProgress200JSONResponse(planItemOut(it)), nil
}
