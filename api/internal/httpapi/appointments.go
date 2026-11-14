package httpapi

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/unsound-mint/parenting-planner/api/internal/appointments"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errNoAppointment = Error{Code: "not_found", Message: "no such appointment"}
	errNoQuestion    = Error{Code: "not_found", Message: "no such question"}
)

func questionOut(q store.AppointmentQuestion) Question {
	return Question{Id: q.ID, Text: q.Body, Answered: q.Answered}
}

func (s *Server) CreateAppointment(ctx context.Context, req CreateAppointmentRequestObject) (CreateAppointmentResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return CreateAppointment401JSONResponse(errNoSession), nil
	}
	a, err := s.q.CreateAppointment(ctx, store.CreateAppointmentParams{FamilyID: familyID, WithName: req.Body.WithName, StartsAt: req.Body.StartsAt})
	if err != nil {
		return nil, err
	}
	return CreateAppointment201JSONResponse(Appointment{Id: a.ID, WithName: a.WithName, StartsAt: a.StartsAt, Questions: []Question{}}), nil
}

func (s *Server) ListAppointments(ctx context.Context, _ ListAppointmentsRequestObject) (ListAppointmentsResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return ListAppointments401JSONResponse(errNoSession), nil
	}
	appts, err := s.q.ListAppointments(ctx, familyID)
	if err != nil {
		return nil, err
	}
	qs, err := s.q.ListAppointmentQuestions(ctx, familyID)
	if err != nil {
		return nil, err
	}
	items := []Appointment{}
	for _, a := range appointments.Assemble(appts, qs, s.cfg.Now()) {
		out := Appointment{Id: a.ID, WithName: a.WithName, StartsAt: a.StartsAt, Questions: make([]Question, 0, len(a.Questions))}
		for _, q := range a.Questions {
			out.Questions = append(out.Questions, Question{Id: q.ID, Text: q.Text, Answered: q.Answered, CarriedOver: q.CarriedOver})
		}
		items = append(items, out)
	}
	return ListAppointments200JSONResponse{Items: items}, nil
}

func (s *Server) CreateAppointmentQuestion(ctx context.Context, req CreateAppointmentQuestionRequestObject) (CreateAppointmentQuestionResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return CreateAppointmentQuestion401JSONResponse(errNoSession), nil
	}
	if _, err := s.q.GetAppointment(ctx, store.GetAppointmentParams{ID: req.AppointmentId, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
		return CreateAppointmentQuestion404JSONResponse(errNoAppointment), nil
	} else if err != nil {
		return nil, err
	}
	q, err := s.q.CreateAppointmentQuestion(ctx, store.CreateAppointmentQuestionParams{FamilyID: familyID, AppointmentID: req.AppointmentId, Body: req.Body.Text})
	if err != nil {
		return nil, err
	}
	return CreateAppointmentQuestion201JSONResponse(questionOut(q)), nil
}

func (s *Server) UpdateAppointmentQuestion(ctx context.Context, req UpdateAppointmentQuestionRequestObject) (UpdateAppointmentQuestionResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return UpdateAppointmentQuestion401JSONResponse(errNoSession), nil
	}
	q, err := s.q.SetQuestionAnswered(ctx, store.SetQuestionAnsweredParams{ID: req.QuestionId, FamilyID: familyID, Answered: req.Body.Answered})
	if errors.Is(err, pgx.ErrNoRows) {
		return UpdateAppointmentQuestion404JSONResponse(errNoQuestion), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateAppointmentQuestion200JSONResponse(questionOut(q)), nil
}
