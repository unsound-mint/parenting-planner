package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/birth"
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

// STUBS for the rest of #428 and for the after-visit note: appointment prep needs the
// calendar and the appointment questions, which are not on main yet.

func (s *Server) GetAppointmentPrep(_ context.Context, _ GetAppointmentPrepRequestObject) (GetAppointmentPrepResponseObject, error) {
	return GetAppointmentPrep501JSONResponse(Error{Code: "not_implemented", Message: "appointment prep is not available yet"}), nil
}

func (s *Server) SaveAppointmentNote(_ context.Context, _ SaveAppointmentNoteRequestObject) (SaveAppointmentNoteResponseObject, error) {
	return SaveAppointmentNote501JSONResponse(Error{Code: "not_implemented", Message: "visit notes are not available yet"}), nil
}
