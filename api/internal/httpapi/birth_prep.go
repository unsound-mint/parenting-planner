package httpapi

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgtype"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/appointments"
	"github.com/unsound-mint/parenting-planner/api/internal/birth"
	"github.com/unsound-mint/parenting-planner/api/internal/calendar"
)

var errNoBirthPlan = Error{Code: "not_found", Message: "this family has no birth plan"}

func (s *Server) GetBirthPlan(ctx context.Context, req GetBirthPlanRequestObject) (GetBirthPlanResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetBirthPlan401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetBirthPlan404JSONResponse(errNoMember), nil
	}
	p, err := birth.Get(ctx, s.pool, familyID, req.MemberId)
	if errors.Is(err, birth.ErrNoPlan) {
		return GetBirthPlan404JSONResponse(errNoBirthPlan), nil
	}
	if err != nil {
		return nil, err
	}
	maps := p.MapsURL
	hospital := Place{Name: p.Hospital.HospitalName, Address: p.Hospital.HospitalAddress, Phone: p.Hospital.HospitalPhone, MapsUrl: &maps}
	if p.Hospital.TravelMinutes.Valid {
		n := int(p.Hospital.TravelMinutes.Int32)
		hospital.TravelMinutes = &n
	}
	out := BirthPlan{Hospital: hospital, Contacts: make([]BirthContact, 0, len(p.Contacts)), Documents: make([]BringItem, 0, len(p.Docs)), PreferencesNote: p.Hospital.PreferencesNote}
	for _, c := range p.Contacts {
		out.Contacts = append(out.Contacts, BirthContact{Label: c.Label, Name: c.Name, Phone: c.Phone, MemberId: c.MemberID})
	}
	for _, d := range p.Docs {
		detail := d.Detail
		out.Documents = append(out.Documents, BringItem{Title: d.Title, Detail: &detail, Ready: d.Ready, TaskId: d.TaskID})
	}
	return GetBirthPlan200JSONResponse(out), nil
}

// CreateLabourAlert tells the other parent that labour has started. A repeat inside
// ten minutes is accepted (204) and sends nothing.
func (s *Server) CreateLabourAlert(ctx context.Context, req CreateLabourAlertRequestObject) (CreateLabourAlertResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateLabourAlert401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateLabourAlert404JSONResponse(errNoMember), nil
	}
	if _, err := birth.SendAlert(ctx, s.pool, familyID, req.MemberId, s.now(ctx)); err != nil {
		if errors.Is(err, birth.ErrNoPlan) {
			return CreateLabourAlert404JSONResponse(errNoBirthPlan), nil
		}
		return nil, err
	}
	return CreateLabourAlert204Response{}, nil
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

		Questions: make([]AppointmentQuestion, 0, len(prep.Questions)),
	}
	docs, travel, err := birth.AppointmentLogistics(ctx, s.pool, familyID, e.Location)
	if err != nil {
		return nil, err
	}
	out.Documents = bringItems(docs)
	if travel != nil {
		minutes := *travel + 10
		maps := birth.MapsURL(*e.Location)
		out.Travel = &AppointmentTravel{LeaveBy: e.StartsAt.Add(-time.Duration(minutes) * time.Minute).UTC(), Minutes: minutes, MapsUrl: &maps}
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

func bringItems(docs []birth.Document) []BringItem {
	items := make([]BringItem, 0, len(docs))
	for _, doc := range docs {
		detail := doc.Detail
		items = append(items, BringItem{Title: doc.Title, Detail: &detail, TaskId: doc.TaskID, Ready: doc.Ready})
	}
	return items
}
