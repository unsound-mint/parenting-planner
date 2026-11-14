package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/health"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errNoChild    = Error{Code: "not_found", Message: "no such child in this family"}
	errFutureDate = Error{Code: "invalid_request", Message: "the date is in the future"}
	errBadRange   = Error{Code: "invalid_request", Message: "the low end of the range is above the high end"}
	errBlankLab   = Error{Code: "invalid_request", Message: "the name and unit must not be blank"}
)

func (s *Server) CreateImmunization(ctx context.Context, req CreateImmunizationRequestObject) (CreateImmunizationResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateImmunization401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateImmunization404JSONResponse(errNoMember), nil
	}
	b := req.Body
	im, err := health.LogDose(ctx, s.pool, familyID, req.MemberId, s.today(ctx), health.NewDose{
		Subject: health.Subject{ChildID: b.ChildId}, Vaccine: string(b.Vaccine), Dose: b.Dose, GivenOn: b.GivenOn.Time,
	})
	switch {
	case errors.Is(err, health.ErrNoChild):
		return CreateImmunization404JSONResponse(errNoChild), nil
	case errors.Is(err, health.ErrFutureDate):
		return CreateImmunization400JSONResponse(errFutureDate), nil
	case err != nil:
		return nil, err
	}
	return CreateImmunization201JSONResponse(givenDoseOut(im)), nil
}

func (s *Server) CreateScreening(ctx context.Context, req CreateScreeningRequestObject) (CreateScreeningResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateScreening401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateScreening404JSONResponse(errNoMember), nil
	}
	b := req.Body
	l, err := health.LogScreening(ctx, s.pool, familyID, req.MemberId, s.today(ctx), health.NewScreening{
		Subject: health.Subject{ChildID: b.ChildId}, Kind: string(b.Kind), TakenOn: b.TakenOn.Time,
		Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, health.ErrNoChild):
		return CreateScreening404JSONResponse(errNoChild), nil
	case errors.Is(err, health.ErrFutureDate):
		return CreateScreening400JSONResponse(errFutureDate), nil
	case err != nil:
		return nil, err
	}
	out := Screening{Id: l.ID, Kind: ScreeningKind(l.Kind), TakenOn: openapi_types.Date{Time: l.TakenOn}, Visibility: Visibility(l.Visibility)}
	if l.SubjectChildID.Valid {
		out.ChildId = &l.SubjectChildID.UUID
	}
	return CreateScreening201JSONResponse(out), nil
}

func (s *Server) CreateLabResult(ctx context.Context, req CreateLabResultRequestObject) (CreateLabResultResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateLabResult401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateLabResult404JSONResponse(errNoMember), nil
	}
	b := req.Body
	l, err := health.LogLabValue(ctx, s.pool, familyID, req.MemberId, s.today(ctx), health.NewLabValue{
		Subject: health.Subject{ChildID: b.ChildId}, Name: b.Name, Unit: b.Unit, Value: float64(b.Value),
		RefLow: optFloat64(b.RefLow), RefHigh: optFloat64(b.RefHigh), TakenOn: b.TakenOn.Time,
		Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, health.ErrNoChild):
		return CreateLabResult404JSONResponse(errNoChild), nil
	case errors.Is(err, health.ErrFutureDate):
		return CreateLabResult400JSONResponse(errFutureDate), nil
	case errors.Is(err, health.ErrBadRange):
		return CreateLabResult400JSONResponse(errBadRange), nil
	case errors.Is(err, health.ErrBlank):
		return CreateLabResult400JSONResponse(errBlankLab), nil
	case err != nil:
		return nil, err
	}
	return CreateLabResult201JSONResponse(labOut(l)), nil
}

func givenDoseOut(im store.Immunization) VaccineDose {
	d := VaccineDose{Id: im.ID, Name: vaccineName(im.Vaccine), Status: VaccineStatusDone, Visibility: VisibilityFamily}
	if im.Dose != nil {
		d.Dose = *im.Dose
	}
	on := im.GivenOn
	d.GivenOn = optDate(&on)
	return d
}

func optFloat64(f *float32) *float64 {
	if f == nil {
		return nil
	}
	v := float64(*f)
	return &v
}
