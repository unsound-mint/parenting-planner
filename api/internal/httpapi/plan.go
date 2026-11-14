package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/aiplan"
	"github.com/unsound-mint/parenting-planner/api/internal/notify"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
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

// GetMemberWeeklyPlan writes the acting parent's weekly note with the Claude API from
// data this parent may see, and falls back to the rule plan on any failure or when
// no key is set. See internal/aiplan for what goes in and what is checked coming out.
func (s *Server) GetMemberWeeklyPlan(ctx context.Context, req GetMemberWeeklyPlanRequestObject) (GetMemberWeeklyPlanResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetMemberWeeklyPlan401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetMemberWeeklyPlan404JSONResponse(errNoMember), nil
	}
	today, now := s.today(ctx), s.now(ctx)
	items, err := plan.ForMember(ctx, s.q, familyID, m.ID, today, now)
	if err != nil {
		return nil, err
	}
	// Only this parent's own check-ins, as numbers; the partner's never enter.
	rows, err := s.q.ListMoodCheckinsVisibleToParent(ctx, store.ListMoodCheckinsVisibleToParentParams{
		FamilyID: familyID, ViewerID: m.ID, Since: now.AddDate(0, 0, -7),
	})
	if err != nil {
		return nil, err
	}
	var moods []aiplan.Mood
	for _, r := range rows {
		if r.OwnerMemberID == m.ID {
			moods = append(moods, aiplan.Mood{Date: r.RecordedAt.Format("2006-01-02"), Mood: int(r.Mood), Energy: int(r.Energy), SleepHours: r.SleepHours})
		}
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var week *int
	if state.HasWeek && state.Stage == "pregnancy" {
		week = &state.Week
	}
	facts := aiplan.NewFacts(m.Role, state.Stage, week, items, moods)
	// Sending the numbers to the model is a read of the parent's own data: it is in the audit log.
	if err := access.Audit(ctx, s.q, familyID, m.ID, access.ActionRead, "weekly_plan", ""); err != nil {
		return nil, err
	}
	// Each Generate is a paid Claude call: past the family's limit the
	// rule-based fallback is shown instead (limits.go).
	out := aiplan.Fallback(facts)
	if s.cfg.AI.Enabled() && s.aiLimiter.allow(familyID.String()) {
		if gen, err := aiplan.New(s.cfg.AI).Generate(ctx, facts); err == nil {
			out = gen
		}
	}
	res := WeeklyPlan{MemberId: m.ID, GeneratedAt: now.UTC(), Fallback: out.Fallback, Intro: out.Intro, Sections: make([]WeeklyPlanSection, 0, len(out.Sections))}
	for _, sec := range out.Sections {
		ws := WeeklyPlanSection{Title: sec.Title, Points: make([]WeeklyPlanPoint, 0, len(sec.Points))}
		for _, p := range sec.Points {
			wp := WeeklyPlanPoint{Text: p.Text, Reason: p.Reason}
			if p.RuleID != "" {
				id := p.RuleID
				wp.RuleId = &id
			}
			if p.Source != nil {
				src := Source{Title: p.Source.Title, Url: p.Source.URL, CheckedAt: openapi_types.Date{Time: p.Source.CheckedAt}}
				wp.Source = &src
			}
			ws.Points = append(ws.Points, wp)
		}
		res.Sections = append(res.Sections, ws)
	}
	return GetMemberWeeklyPlan200JSONResponse(res), nil
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
