package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/appointments"
)

var (
	errNoUpcomingAppointment = Error{Code: "no_upcoming_appointment", Message: "there is no upcoming appointment to add the question to"}
	errNoAppointment         = Error{Code: "not_found", Message: "no such appointment"}
	errNoQuestion            = Error{Code: "not_found", Message: "no such question"}
)

func questionOut(r appointments.Resolved) AppointmentQuestion {
	q := r.AppointmentQuestion
	out := AppointmentQuestion{
		Id: q.ID, AuthorId: q.OwnerMemberID, Text: q.Body, AppointmentId: r.AppointmentID, AskedForAppointmentId: q.AskedForEventID,
		CarriedOver: r.CarriedOver, Answered: q.Answered, Answer: q.Answer, Visibility: Visibility(q.Visibility), CreatedAt: q.CreatedAt,
	}
	if q.AnsweredAt.Valid {
		out.AnsweredAt = &q.AnsweredAt.Time
	}
	return out
}

func (s *Server) CreateAppointmentQuestion(ctx context.Context, req CreateAppointmentQuestionRequestObject) (CreateAppointmentQuestionResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateAppointmentQuestion401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateAppointmentQuestion404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return CreateAppointmentQuestion403JSONResponse(errForbidden), nil
	}
	b := req.Body
	q, err := appointments.Create(ctx, s.pool, familyID, m.ID, b.Text, string(b.Visibility), b.AppointmentId, s.now(ctx))
	switch {
	case errors.Is(err, appointments.ErrNoUpcoming):
		return CreateAppointmentQuestion409JSONResponse(errNoUpcomingAppointment), nil
	case errors.Is(err, appointments.ErrNoAppointment):
		return CreateAppointmentQuestion404JSONResponse(errNoAppointment), nil
	case err != nil:
		return nil, err
	}
	// A new question is under the appointment it was added to.
	id := q.AskedForEventID
	return CreateAppointmentQuestion201JSONResponse(questionOut(appointments.Resolved{AppointmentQuestion: q, AppointmentID: &id})), nil
}

func (s *Server) ListAppointmentQuestions(ctx context.Context, req ListAppointmentQuestionsRequestObject) (ListAppointmentQuestionsResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListAppointmentQuestions401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListAppointmentQuestions404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return ListAppointmentQuestions403JSONResponse(errForbidden), nil
	}
	var only *uuid.UUID
	if req.Params.AppointmentId != nil {
		only = req.Params.AppointmentId
	}
	res, err := appointments.List(ctx, s.pool, familyID, m.ID, only, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := AppointmentQuestionList{Items: make([]AppointmentQuestion, 0, len(res.Items)), Appointments: make([]CalendarEvent, 0, len(res.Appointments))}
	for _, it := range res.Items {
		out.Items = append(out.Items, questionOut(it))
	}
	for _, a := range res.Appointments {
		ev := CalendarEvent{
			Id: a.ID.String(), Kind: CalendarEventKindAppointment, Title: a.Title, StartsAt: a.StartsAt, AllDay: a.AllDay, Location: a.Location,
			OwnerId: &a.OwnerMemberID, AttendeeIds: a.AttendeeIds, Visibility: CalendarVisibility(a.Visibility),
		}
		if a.EndsAt.Valid {
			ev.EndsAt = &a.EndsAt.Time
		}
		if ev.AttendeeIds == nil {
			ev.AttendeeIds = []openapi_types.UUID{}
		}
		out.Appointments = append(out.Appointments, ev)
	}
	return ListAppointmentQuestions200JSONResponse(out), nil
}

func (s *Server) UpdateAppointmentQuestion(ctx context.Context, req UpdateAppointmentQuestionRequestObject) (UpdateAppointmentQuestionResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateAppointmentQuestion401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateAppointmentQuestion404JSONResponse(errNoMember), nil
	}
	q, err := appointments.Answer(ctx, s.pool, familyID, m.ID, req.QuestionId, req.Body.Answered, req.Body.Answer, s.now(ctx))
	if errors.Is(err, appointments.ErrNoQuestion) {
		return UpdateAppointmentQuestion404JSONResponse(errNoQuestion), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateAppointmentQuestion200JSONResponse(questionOut(q)), nil
}
