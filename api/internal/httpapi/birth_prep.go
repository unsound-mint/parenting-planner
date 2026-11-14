package httpapi

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgtype"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/appointments"
	"github.com/unsound-mint/parenting-planner/api/internal/calendar"
)

// STUB for the birth prep issue: the contract is in openapi.yaml, the
// implementation is not written yet. Replace each stub with a real handler
// (copy wellbeing.go), remove its 501 from openapi.yaml and replace its test.
// The web shows preview mocks on 501.

func (s *Server) GetBirthPlan(_ context.Context, _ GetBirthPlanRequestObject) (GetBirthPlanResponseObject, error) {
	return GetBirthPlan501JSONResponse(Error{Code: "not_implemented", Message: "the birth plan is not available yet"}), nil
}

func (s *Server) CreateLabourAlert(_ context.Context, _ CreateLabourAlertRequestObject) (CreateLabourAlertResponseObject, error) {
	return CreateLabourAlert501JSONResponse(Error{Code: "not_implemented", Message: "labour alerts are not available yet"}), nil
}

var errVisitNotStarted = Error{Code: "visit_not_started", Message: "you can save a note once the visit starts"}

func (s *Server) GetAppointmentPrep(ctx context.Context, req GetAppointmentPrepRequestObject) (GetAppointmentPrepResponseObject, error) {
	familyID, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetAppointmentPrep401JSONResponse(errNoSession), nil
	case kind != errNone:
		return GetAppointmentPrep404JSONResponse(errNoMember), nil
	}
	prep, err := appointments.GetPrep(ctx, s.pool, familyID, member.ID, req.AppointmentId, s.now(ctx))
	if errors.Is(err, appointments.ErrNoAppointment) {
		return GetAppointmentPrep404JSONResponse(errNoAppointment), nil
	}
	if err != nil {
		return nil, err
	}
	e := prep.Event
	out := AppointmentPrep{
		Appointment: calendarEventOut(calendar.Event{ID: e.ID.String(), Kind: e.Kind, Title: e.Title, StartsAt: e.StartsAt,
			EndsAt: calendarEnd(e.EndsAt), AllDay: e.AllDay, Location: e.Location, OwnerID: &e.OwnerMemberID,
			AttendeeIDs: e.AttendeeIds, Visibility: e.Visibility}),
		Documents: []BringItem{{Title: "Photo ID and insurance card"}},
		Questions: make([]AppointmentQuestion, 0, len(prep.Questions)),
	}
	for _, question := range prep.Questions {
		out.Questions = append(out.Questions, questionOut(question))
	}
	if n := prep.Note; n != nil {
		out.Note = &AppointmentNote{Text: n.Body, UpdatedAt: n.UpdatedAt.UTC()}
	}
	return GetAppointmentPrep200JSONResponse(out), nil
}

func (s *Server) SaveAppointmentNote(ctx context.Context, req SaveAppointmentNoteRequestObject) (SaveAppointmentNoteResponseObject, error) {
	familyID, member, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SaveAppointmentNote401JSONResponse(errNoSession), nil
	case kind != errNone:
		return SaveAppointmentNote404JSONResponse(errNoMember), nil
	}
	note, err := appointments.SaveNote(ctx, s.pool, familyID, member.ID, req.AppointmentId, req.Body.Text, s.now(ctx))
	switch {
	case errors.Is(err, appointments.ErrNoAppointment):
		return SaveAppointmentNote404JSONResponse(errNoAppointment), nil
	case errors.Is(err, appointments.ErrVisitNotStarted):
		return SaveAppointmentNote409JSONResponse(errVisitNotStarted), nil
	case err != nil:
		return nil, err
	}
	return SaveAppointmentNote200JSONResponse{Text: note.Body, UpdatedAt: note.UpdatedAt.UTC()}, nil
}

func calendarEnd(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	return &ts.Time
}
