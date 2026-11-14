package httpapi

import (
	"context"
	"slices"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/calendar"
	"github.com/unsound-mint/parenting-planner/api/internal/carelog"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

// GetToday builds the acting person's Today screen from the same sources as
// the other endpoints. A section the person may not see is left empty, never
// filled with someone else's data. pregnancyWeek is left out because the contract requires a size
// comparison and the catalog has no sourced sizes.
func (s *Server) GetToday(ctx context.Context, req GetTodayRequestObject) (GetTodayResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetToday401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetToday404JSONResponse(errNoMember), nil
	}
	today, now := s.today(ctx), s.now(ctx)
	parent := isParentRole(m.Role)
	has := func(p string) bool { return parent || slices.Contains(m.Permissions, p) }

	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	out := Today{
		MemberId: m.ID, Role: PersonRole(m.Role), Date: openapi_types.Date{Time: today}, Stage: Stage(fam.Stage),
		PlanItems: []PlanItem{}, Tasks: []Task{}, Events: []CalendarEvent{}, PendingHandoffs: []Handoff{}, Guides: []Guide{},
	}

	// Plan items: parents only, the three that need attention most.
	if parent {
		items, err := plan.ForMember(ctx, s.q, familyID, m.ID, today, now)
		if err != nil {
			return nil, err
		}
		for _, it := range items {
			if len(out.PlanItems) == 3 {
				break
			}
			if it.Status == rules.Overdue || it.Status == rules.Due {
				out.PlanItems = append(out.PlanItems, planItemOut(it))
			}
		}
	}

	// Calendar: today and tomorrow. Parents see what the family scope allows;
	// a caregiver sees their own events, and only with the schedule permission.
	if has("schedule") {
		var events []calendar.Event
		if parent {
			events, err = calendar.ListForParent(ctx, s.pool, familyID, m.ID, calendar.Family, today, today.AddDate(0, 0, 2))
		} else {
			events, err = calendar.ListForCaregiver(ctx, s.pool, familyID, m.ID, today, today.AddDate(0, 0, 2))
		}
		if err != nil {
			return nil, err
		}
		for _, e := range events {
			out.Events = append(out.Events, calendarEventOut(e))
		}
		next, err := calendar.NextShift(ctx, s.pool, familyID, m.ID, now)
		if err != nil {
			return nil, err
		}
		if next != nil {
			ev := calendarEventOut(*next)
			out.NextShift = &ev
		}
	}

	// Tasks: the person's own that are overdue or due within 7 days, then the ones offered to them.
	if has("family_plan") {
		items, err := tasks.List(ctx, s.pool, familyID, nil)
		if err != nil {
			return nil, err
		}
		week := today.AddDate(0, 0, 7)
		var offered []Task
		for _, it := range items {
			switch {
			case it.PendingAssigneeMemberID.Valid && it.PendingAssigneeMemberID.UUID == m.ID && !it.Done:
				offered = append(offered, taskOut(it))
			case it.AssigneeMemberID == m.ID && !it.Done && it.Kind != "hospital_bag" && it.Deadline.On != nil && it.Deadline.On.Before(week):
				out.Tasks = append(out.Tasks, taskOut(it))
			}
		}
		out.Tasks = append(out.Tasks, offered...)
	}

	// Care: the summary and handoffs waiting for the person, once the baby is home.
	kids, err := s.q.ListChildren(ctx, familyID)
	if err != nil {
		return nil, err
	}
	if has("care_log") {
		pending, err := carelog.PendingFor(ctx, s.pool, familyID, m.ID, now)
		if err != nil {
			return nil, err
		}
		sum, err := carelog.LatestSummary(ctx, s.pool, familyID, now)
		if err != nil {
			return nil, err
		}
		for _, h := range pending {
			out.PendingHandoffs = append(out.PendingHandoffs, handoffOut(h, sum))
		}
		if len(kids) > 0 {
			cs := careSummaryOut(sum)
			out.CareSummary = &cs
		}
	}

	// Guides: two for the stage. A nanny's Today is about shifts and care only.
	if m.Role != "nanny" {
		state, _, err := s.contentState(ctx, familyID)
		if err != nil {
			return nil, err
		}
		viewer := content.Viewer{Role: m.Role, PregnancyUpdates: slices.Contains(m.Permissions, "pregnancy_updates")}
		for _, e := range content.Guides(state, viewer, "") {
			if len(out.Guides) == 2 {
				break
			}
			if !e.Locked {
				out.Guides = append(out.Guides, guideOut(e))
			}
		}
	}
	return GetToday200JSONResponse(out), nil
}
