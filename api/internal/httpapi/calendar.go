package httpapi

import (
	"context"
	"errors"

	"github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/calendar"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// STUB for #229: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) ListCalendarEvents(_ context.Context, _ ListCalendarEventsRequestObject) (ListCalendarEventsResponseObject, error) {
	return ListCalendarEvents501JSONResponse(Error{Code: "not_implemented", Message: "the calendar is not available yet"}), nil
}

func (s *Server) CreateCalendarEvent(_ context.Context, _ CreateCalendarEventRequestObject) (CreateCalendarEventResponseObject, error) {
	return CreateCalendarEvent501JSONResponse(Error{Code: "not_implemented", Message: "the calendar is not available yet"}), nil
}

// Appointment questions are for the parents. A grandparent or nanny, once
// members can have those roles, gets 403.
func isParent(m store.Member) bool { return m.Role == "mother" || m.Role == "partner" }

func (s *Server) CreateAppointmentQuestion(ctx context.Context, req CreateAppointmentQuestionRequestObject) (CreateAppointmentQuestionResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateAppointmentQuestion401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateAppointmentQuestion404JSONResponse(errNoMember), nil
	case !isParent(m):
		return CreateAppointmentQuestion403JSONResponse(errForbidden), nil
	}
	b := req.Body
	q, err := calendar.CreateQuestion(ctx, s.pool, familyID, m.ID, s.cfg.Now(), calendar.NewQuestion{
		Text: b.Text, AppointmentID: b.AppointmentId, Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, calendar.ErrNoAppointment):
		return CreateAppointmentQuestion404JSONResponse(errNoAppointment), nil
	case errors.Is(err, calendar.ErrNoUpcomingAppointment):
		return CreateAppointmentQuestion409JSONResponse(errNoUpcomingAppointment), nil
	case err != nil:
		return nil, err
	}
	return CreateAppointmentQuestion201JSONResponse(appointmentQuestionOut(q)), nil
}

func (s *Server) ListAppointmentQuestions(ctx context.Context, req ListAppointmentQuestionsRequestObject) (ListAppointmentQuestionsResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListAppointmentQuestions401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListAppointmentQuestions404JSONResponse(errNoMember), nil
	case !isParent(m):
		return ListAppointmentQuestions403JSONResponse(errForbidden), nil
	}
	items, appts, err := calendar.ListQuestions(ctx, s.pool, familyID, m.ID, s.cfg.Now(), req.Params.AppointmentId)
	if err != nil {
		return nil, err
	}
	out := AppointmentQuestionList{Appointments: make([]CalendarEvent, 0, len(appts)), Items: make([]AppointmentQuestion, 0, len(items))}
	for _, a := range appts {
		out.Appointments = append(out.Appointments, calendarEventOut(a))
	}
	for _, q := range items {
		out.Items = append(out.Items, appointmentQuestionOut(q))
	}
	return ListAppointmentQuestions200JSONResponse(out), nil
}

func (s *Server) UpdateAppointmentQuestion(ctx context.Context, req UpdateAppointmentQuestionRequestObject) (UpdateAppointmentQuestionResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateAppointmentQuestion401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateAppointmentQuestion404JSONResponse(errNoMember), nil
	}
	// Only the author may update, so a caregiver (never an author) gets 404 like any other non-author.
	q, err := calendar.AnswerQuestion(ctx, s.pool, familyID, m.ID, req.QuestionId, s.cfg.Now(), req.Body.Answered, req.Body.Answer)
	switch {
	case errors.Is(err, calendar.ErrNoQuestion):
		return UpdateAppointmentQuestion404JSONResponse(errNoQuestion), nil
	case err != nil:
		return nil, err
	}
	return UpdateAppointmentQuestion200JSONResponse(appointmentQuestionOut(q)), nil
}

func appointmentQuestionOut(q calendar.Question) AppointmentQuestion {
	return AppointmentQuestion{
		Id: q.ID, AuthorId: q.AuthorID, Text: q.Text, AppointmentId: q.AppointmentID,
		AskedForAppointmentId: q.AskedForAppointmentID, CarriedOver: q.CarriedOver,
		Answered: q.AnsweredAt != nil, Answer: q.Answer, AnsweredAt: q.AnsweredAt,
		Visibility: Visibility(q.Visibility), CreatedAt: q.CreatedAt.UTC(),
	}
}

func calendarEventOut(e store.CalendarEvent) CalendarEvent {
	out := CalendarEvent{
		Id: e.ID.String(), Kind: CalendarEventKind(e.Kind), Title: e.Title, StartsAt: e.StartsAt.UTC(),
		AllDay: e.AllDay, Location: e.Location, AttendeeIds: []types.UUID{},
		Visibility: CalendarVisibility(e.Visibility),
	}
	if e.OwnerMemberID.Valid {
		out.OwnerId = &e.OwnerMemberID.UUID
	}
	if e.EndsAt.Valid {
		t := e.EndsAt.Time.UTC()
		out.EndsAt = &t
	}
	return out
}
