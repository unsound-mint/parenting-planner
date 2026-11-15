package httpapi

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/calendar"
)

var (
	errNoCalendarEvent   = Error{Code: "not_found", Message: "no such calendar event"}
	errCalendarForbidden = Error{Code: "forbidden", Message: "you may only see your own schedule"}
	errBadWindow         = Error{Code: "bad_window", Message: "from and to must be dates at most 31 days apart, to not before from"}
	errBadAttendee       = Error{Code: "bad_attendee", Message: "every attendee must be a person in this family"}
	errBadTimes          = Error{Code: "bad_times", Message: "endsAt must not be before startsAt"}
)

func calendarEventOut(e calendar.Event) CalendarEvent {
	out := CalendarEvent{
		Id: e.ID, Kind: CalendarEventKind(e.Kind), Title: e.Title, StartsAt: e.StartsAt, EndsAt: e.EndsAt, AllDay: e.AllDay,
		Location: e.Location, OwnerId: e.OwnerID, AttendeeIds: e.AttendeeIDs, Visibility: CalendarVisibility(e.Visibility),
		ShiftId: e.ShiftID, TaskId: e.TaskID, NeutralTitle: &e.NeutralTitle,
	}
	if out.AttendeeIds == nil {
		out.AttendeeIds = []uuid.UUID{}
	}
	return out
}

func (s *Server) ListCalendarEvents(ctx context.Context, req ListCalendarEventsRequestObject) (ListCalendarEventsResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListCalendarEvents401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListCalendarEvents404JSONResponse(errNoMember), nil
	}
	today := s.today(ctx)
	from, to := today, today.AddDate(0, 0, 6)
	if p := req.Params.From; p != nil {
		from = p.Time
	}
	if p := req.Params.To; p != nil {
		to = p.Time
	} else if req.Params.From != nil {
		to = from.AddDate(0, 0, 6)
	}
	until := to.AddDate(0, 0, 1) // "to" is inclusive
	scope := calendar.Family
	if sc := req.Params.Scope; sc != nil {
		scope = calendar.Scope(*sc)
	}

	var events []calendar.Event
	if isParentRole(m.Role) {
		events, err = calendar.ListForParent(ctx, s.pool, familyID, m.ID, scope, from, until)
	} else {
		// A caregiver needs the schedule permission and may only use mine (the default is family for parents).
		if !slices.Contains(m.Permissions, "schedule") || (req.Params.Scope != nil && scope != calendar.Mine) {
			return ListCalendarEvents403JSONResponse(errCalendarForbidden), nil
		}
		events, err = calendar.ListForCaregiver(ctx, s.pool, familyID, m.ID, from, until)
	}
	if errors.Is(err, calendar.ErrBadWindow) {
		return ListCalendarEvents400JSONResponse(errBadWindow), nil
	}
	if err != nil {
		return nil, err
	}
	items := make([]CalendarEvent, 0, len(events))
	for _, e := range events {
		items = append(items, calendarEventOut(e))
	}
	return ListCalendarEvents200JSONResponse{From: apiDate(from), To: apiDate(to), Items: items}, nil
}

func (s *Server) CreateCalendarEvent(ctx context.Context, req CreateCalendarEventRequestObject) (CreateCalendarEventResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateCalendarEvent401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateCalendarEvent404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return CreateCalendarEvent403JSONResponse(errForbidden), nil
	}
	b := req.Body
	var attendees []uuid.UUID
	if b.AttendeeIds != nil {
		attendees = *b.AttendeeIds
	}
	in := calendar.NewEvent{
		Kind: string(b.Kind), Title: b.Title, StartsAt: b.StartsAt, EndsAt: b.EndsAt, Location: b.Location,
		Attendees: attendees, Visibility: string(b.Visibility),
	}
	if b.NeutralTitle != nil {
		in.NeutralTitle = *b.NeutralTitle
	}
	if b.AllDay != nil {
		in.AllDay = *b.AllDay
	}
	e, err := calendar.Create(ctx, s.pool, familyID, m.ID, in, s.now(ctx))
	switch {
	case errors.Is(err, calendar.ErrBadAttendee):
		return CreateCalendarEvent400JSONResponse(errBadAttendee), nil
	case errors.Is(err, calendar.ErrBadTimes):
		return CreateCalendarEvent400JSONResponse(errBadTimes), nil
	case err != nil:
		return nil, err
	}
	return CreateCalendarEvent201JSONResponse(calendarEventOut(e)), nil
}

func apiDate(t time.Time) openapi_types.Date { return openapi_types.Date{Time: t} }
func (s *Server) UpdateCalendarEvent(ctx context.Context, req UpdateCalendarEventRequestObject) (UpdateCalendarEventResponseObject, error) {
	family, actor, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateCalendarEvent401JSONResponse(errNoSession), nil
	case kind != errNone:
		return UpdateCalendarEvent404JSONResponse(errNoMember), nil
	case !isParentRole(actor.Role):
		return UpdateCalendarEvent403JSONResponse(errForbidden), nil
	}
	b := req.Body
	in := calendar.EventUpdate{Title: b.Title, StartsAt: b.StartsAt, EndsAt: b.EndsAt, Location: b.Location,
		AllDay: b.AllDay, Attendees: b.AttendeeIds, NeutralTitle: b.NeutralTitle}
	if b.Visibility != nil {
		visibility := string(*b.Visibility)
		in.Visibility = &visibility
	}
	out, err := calendar.Update(ctx, s.pool, family, actor.ID, req.EventId, in, s.now(ctx))
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return UpdateCalendarEvent404JSONResponse(errNoCalendarEvent), nil
	case errors.Is(err, calendar.ErrBadAttendee):
		return UpdateCalendarEvent400JSONResponse(errBadAttendee), nil
	case errors.Is(err, calendar.ErrBadTimes):
		return UpdateCalendarEvent400JSONResponse(errBadTimes), nil
	case err != nil:
		return nil, err
	}
	return UpdateCalendarEvent200JSONResponse(calendarEventOut(out)), nil
}

func (s *Server) DeleteCalendarEvent(ctx context.Context, req DeleteCalendarEventRequestObject) (DeleteCalendarEventResponseObject, error) {
	family, actor, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteCalendarEvent401JSONResponse(errNoSession), nil
	case kind != errNone:
		return DeleteCalendarEvent404JSONResponse(errNoMember), nil
	case !isParentRole(actor.Role):
		return DeleteCalendarEvent403JSONResponse(errForbidden), nil
	}
	err = calendar.Delete(ctx, s.pool, family, actor.ID, req.EventId, s.now(ctx))
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return DeleteCalendarEvent404JSONResponse(errNoCalendarEvent), nil
	case err != nil:
		return nil, err
	}
	return DeleteCalendarEvent204Response{}, nil
}
