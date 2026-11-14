package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/journey"
)

func (s *Server) GetMemberJourney(ctx context.Context, req GetMemberJourneyRequestObject) (GetMemberJourneyResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetMemberJourney401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetMemberJourney404JSONResponse(errNoMember), nil
	}
	today := s.today()
	j, err := journey.ForMember(ctx, s.q, familyID, req.MemberId, today, s.cfg.Now())
	if err != nil {
		return nil, err
	}

	cur := JourneyPosition{Stage: JourneyStage(j.Current.Stage), GestationalWeek: j.Current.GestationalWeek}
	if c := j.Current.Child; c != nil {
		weeks := int(today.Sub(c.BirthDate).Hours() / 24 / 7)
		months := monthsBetween(c.BirthDate, today)
		cur.ChildId, cur.ChildAgeWeeks, cur.ChildAgeMonths = &c.ID, &weeks, &months
	}
	out := Journey{
		MemberId: req.MemberId, GeneratedAt: s.cfg.Now().UTC(), Current: cur,
		Stages: make([]JourneySpan, 0, len(j.Stages)), Upcoming: make([]PlanItem, 0, len(j.Upcoming)),
	}
	for _, sp := range j.Stages {
		js := JourneySpan{Stage: JourneyStage(sp.Stage), Status: JourneySpanStatus(sp.Status)}
		if sp.Starts != nil {
			js.StartsOn = &openapi_types.Date{Time: *sp.Starts}
		}
		if sp.Ends != nil {
			js.EndsOn = &openapi_types.Date{Time: *sp.Ends}
		}
		out.Stages = append(out.Stages, js)
	}
	for _, it := range j.Upcoming {
		out.Upcoming = append(out.Upcoming, planItemOut(it))
	}
	return GetMemberJourney200JSONResponse(out), nil
}
