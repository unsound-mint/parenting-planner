package httpapi

import (
	"context"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
)

// ListWeeklyReads serves the family's weekly reads with today's marked. The
// anchor is the due date in pregnancy and the youngest child's birth date
// after a birth (journey.Place makes the same choice).
func (s *Server) ListWeeklyReads(ctx context.Context, req ListWeeklyReadsRequestObject) (ListWeeklyReadsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListWeeklyReads401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListWeeklyReads404JSONResponse(errNoMember), nil
	}
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	kids, err := s.q.ListChildren(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var birth *time.Time
	if n := len(kids); n > 0 {
		birth = &kids[n-1].BirthDate // ListChildren is oldest first
	}
	items, cur := content.WeeklyReadsFor(fam.Stage, fam.DueDate, birth, s.today(ctx))
	out := WeeklyReadList{Current: cur, Items: make([]WeeklyRead, 0, len(items))}
	for _, r := range items {
		w := WeeklyRead{Id: r.ID(), Kind: WeeklyReadKind(r.Kind), N: r.N, Label: r.Label(), Title: r.Title, Body: r.Body, Sources: make([]Source, 0, len(r.Sources))}
		if r.Starts != nil {
			w.StartsOn = &openapi_types.Date{Time: *r.Starts}
		}
		if r.Ends != nil {
			w.EndsOn = &openapi_types.Date{Time: *r.Ends}
		}
		for _, src := range r.Sources {
			w.Sources = append(w.Sources, sourceOut(src))
		}
		out.Items = append(out.Items, w)
	}
	return ListWeeklyReads200JSONResponse(out), nil
}
