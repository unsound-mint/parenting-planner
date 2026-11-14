package httpapi

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/milestones"
)

var errNoMilestone = Error{Code: "not_found", Message: "no checklist or milestone for this child"}

func milestoneOut(item milestones.Item, day *time.Time) Milestone {
	out := Milestone{Id: item.ID, Domain: MilestoneDomain(item.Domain), Text: item.Text, Observed: day != nil}
	if day != nil {
		value := apiDate(*day)
		out.ObservedOn = &value
	}
	return out
}

func (s *Server) ListChildMilestones(ctx context.Context, req ListChildMilestonesRequestObject) (ListChildMilestonesResponseObject, error) {
	family, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListChildMilestones401JSONResponse(errNoSession), nil
	case kind != errNone:
		return ListChildMilestones404JSONResponse(errNoMember), nil
	}
	age, items, observed, err := milestones.Read(ctx, s.pool, family, member.ID, req.ChildId, s.today(ctx))
	if errors.Is(err, milestones.ErrNotFound) {
		return ListChildMilestones404JSONResponse(errNoMilestone), nil
	}
	if err != nil {
		return nil, err
	}
	out := MilestoneChecklist{ChildId: req.ChildId, ChecklistAgeMonths: age, Items: make([]Milestone, 0, len(items)),
		Source: Source{Title: fmt.Sprintf("CDC: Milestones by %d Years", age/12), Url: milestones.SourceURL(age), CheckedAt: apiDate(milestones.CheckedAt)}}
	for _, item := range items {
		var date *time.Time
		if day, ok := observed[item.ID]; ok {
			date = &day
		}
		out.Items = append(out.Items, milestoneOut(item, date))
	}
	return ListChildMilestones200JSONResponse(out), nil
}

func (s *Server) SetChildMilestone(ctx context.Context, req SetChildMilestoneRequestObject) (SetChildMilestoneResponseObject, error) {
	family, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SetChildMilestone401JSONResponse(errNoSession), nil
	case kind != errNone:
		return SetChildMilestone404JSONResponse(errNoMember), nil
	}
	item, date, err := milestones.Set(ctx, s.pool, family, member.ID, req.ChildId, req.MilestoneId, req.Body.Observed, s.today(ctx))
	if errors.Is(err, milestones.ErrNotFound) {
		return SetChildMilestone404JSONResponse(errNoMilestone), nil
	}
	if err != nil {
		return nil, err
	}
	return SetChildMilestone200JSONResponse(milestoneOut(item, date)), nil
}
