package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/health"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errNoChild    = Error{Code: "not_found", Message: "no such child in this family"}
	errFutureDate = Error{Code: "invalid_request", Message: "the date is in the future"}
	errBadRange   = Error{Code: "invalid_request", Message: "the low end of the range is above the high end"}
	errBlankLab   = Error{Code: "invalid_request", Message: "the name and unit must not be blank"}
	errBadKind    = Error{Code: "invalid_request", Message: "the screening kind is not in the catalog, or kind other needs a name"}
	errBlankName  = Error{Code: "invalid_request", Message: "the name must not be blank"}
	errNoRecord   = Error{Code: "not_found", Message: "no such record for this parent"}
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
		Subject: health.Subject{ChildID: b.ChildId}, Kind: string(b.Kind), Name: b.Name, TakenOn: b.TakenOn.Time,
		Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, health.ErrNoChild):
		return CreateScreening404JSONResponse(errNoChild), nil
	case errors.Is(err, health.ErrFutureDate):
		return CreateScreening400JSONResponse(errFutureDate), nil
	case errors.Is(err, health.ErrBadScreening):
		return CreateScreening400JSONResponse(errBadKind), nil
	case err != nil:
		return nil, err
	}
	return CreateScreening201JSONResponse(screeningOut(l)), nil
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
		Visibility: access.Visibility(b.Visibility), Now: s.now(ctx),
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

func (s *Server) UpdateLabResult(ctx context.Context, req UpdateLabResultRequestObject) (UpdateLabResultResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateLabResult401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateLabResult404JSONResponse(errNoMember), nil
	}
	b := req.Body
	l, err := health.UpdateLabValue(ctx, s.pool, familyID, req.MemberId, s.today(ctx), health.LabEdit{
		ID: req.LabId, Name: b.Name, Unit: b.Unit, Value: float64(b.Value),
		RefLow: optFloat64(b.RefLow), RefHigh: optFloat64(b.RefHigh), TakenOn: b.TakenOn.Time,
		Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, health.ErrFutureDate):
		return UpdateLabResult400JSONResponse(errFutureDate), nil
	case errors.Is(err, health.ErrBadRange):
		return UpdateLabResult400JSONResponse(errBadRange), nil
	case errors.Is(err, health.ErrBlank):
		return UpdateLabResult400JSONResponse(errBlankLab), nil
	case errors.Is(err, health.ErrNotFound):
		return UpdateLabResult404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return UpdateLabResult200JSONResponse(labOut(l)), nil
}

func (s *Server) DeleteLabResult(ctx context.Context, req DeleteLabResultRequestObject) (DeleteLabResultResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteLabResult401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteLabResult404JSONResponse(errNoMember), nil
	}
	err = health.DeleteLabValue(ctx, s.pool, familyID, req.MemberId, req.LabId)
	switch {
	case errors.Is(err, health.ErrNotFound):
		return DeleteLabResult404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return DeleteLabResult204Response{}, nil
}

func (s *Server) UpdateScreening(ctx context.Context, req UpdateScreeningRequestObject) (UpdateScreeningResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateScreening401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateScreening404JSONResponse(errNoMember), nil
	}
	b := req.Body
	l, err := health.UpdateScreening(ctx, s.pool, familyID, req.MemberId, s.today(ctx), health.ScreeningEdit{
		ID: req.ScreeningId, Kind: string(b.Kind), Name: b.Name, TakenOn: b.TakenOn.Time,
		Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, health.ErrFutureDate):
		return UpdateScreening400JSONResponse(errFutureDate), nil
	case errors.Is(err, health.ErrBadScreening):
		return UpdateScreening400JSONResponse(errBadKind), nil
	case errors.Is(err, health.ErrNotFound):
		return UpdateScreening404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return UpdateScreening200JSONResponse(screeningOut(l)), nil
}

func (s *Server) DeleteScreening(ctx context.Context, req DeleteScreeningRequestObject) (DeleteScreeningResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteScreening401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteScreening404JSONResponse(errNoMember), nil
	}
	err = health.DeleteScreening(ctx, s.pool, familyID, req.MemberId, req.ScreeningId)
	switch {
	case errors.Is(err, health.ErrNotFound):
		return DeleteScreening404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return DeleteScreening204Response{}, nil
}

func (s *Server) CreateAllergy(ctx context.Context, req CreateAllergyRequestObject) (CreateAllergyResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateAllergy401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateAllergy404JSONResponse(errNoMember), nil
	}
	b := req.Body
	a, err := health.CreateAllergy(ctx, s.pool, familyID, req.MemberId, s.today(ctx), health.NewAllergy{
		Subject: health.Subject{ChildID: b.ChildId}, Substance: b.Substance, Certainty: string(b.Certainty),
		Reaction: b.Reaction, Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, health.ErrBlank):
		return CreateAllergy400JSONResponse(errBlankName), nil
	case errors.Is(err, health.ErrNoChild):
		return CreateAllergy404JSONResponse(errNoChild), nil
	case err != nil:
		return nil, err
	}
	return CreateAllergy201JSONResponse(allergyOut(a)), nil
}

func (s *Server) UpdateAllergy(ctx context.Context, req UpdateAllergyRequestObject) (UpdateAllergyResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateAllergy401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateAllergy404JSONResponse(errNoMember), nil
	}
	b := req.Body
	a, err := health.UpdateAllergy(ctx, s.pool, familyID, req.MemberId, health.AllergyEdit{
		ID: req.AllergyId, Substance: b.Substance, Certainty: string(b.Certainty),
		Reaction: b.Reaction, Visibility: access.Visibility(b.Visibility),
	})
	switch {
	case errors.Is(err, health.ErrBlank):
		return UpdateAllergy400JSONResponse(errBlankName), nil
	case errors.Is(err, health.ErrNotFound):
		return UpdateAllergy404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return UpdateAllergy200JSONResponse(allergyOut(a)), nil
}

func (s *Server) DeleteAllergy(ctx context.Context, req DeleteAllergyRequestObject) (DeleteAllergyResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteAllergy401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteAllergy404JSONResponse(errNoMember), nil
	}
	err = health.DeleteAllergy(ctx, s.pool, familyID, req.MemberId, req.AllergyId)
	switch {
	case errors.Is(err, health.ErrNotFound):
		return DeleteAllergy404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return DeleteAllergy204Response{}, nil
}

func (s *Server) UpdateImmunization(ctx context.Context, req UpdateImmunizationRequestObject) (UpdateImmunizationResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateImmunization401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateImmunization404JSONResponse(errNoMember), nil
	}
	b := req.Body
	im, err := health.UpdateImmunization(ctx, s.pool, familyID, req.MemberId, s.today(ctx), health.ImmunizationEdit{
		ID: req.ImmunizationId, Vaccine: string(b.Vaccine), Dose: b.Dose, GivenOn: b.GivenOn.Time,
	})
	switch {
	case errors.Is(err, health.ErrFutureDate):
		return UpdateImmunization400JSONResponse(errFutureDate), nil
	case errors.Is(err, health.ErrNotFound):
		return UpdateImmunization404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return UpdateImmunization200JSONResponse(givenDoseOut(im)), nil
}

func (s *Server) DeleteImmunization(ctx context.Context, req DeleteImmunizationRequestObject) (DeleteImmunizationResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteImmunization401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteImmunization404JSONResponse(errNoMember), nil
	}
	err = health.DeleteImmunization(ctx, s.pool, familyID, req.MemberId, req.ImmunizationId)
	switch {
	case errors.Is(err, health.ErrNotFound):
		return DeleteImmunization404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return DeleteImmunization204Response{}, nil
}

func (s *Server) CreateCareTeamMember(ctx context.Context, req CreateCareTeamMemberRequestObject) (CreateCareTeamMemberResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateCareTeamMember401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateCareTeamMember404JSONResponse(errNoMember), nil
	}
	b := req.Body
	c, err := health.CreateCareTeamMember(ctx, s.pool, familyID, req.MemberId, health.NewCareTeamMember{
		Subject: health.Subject{ChildID: b.ChildId}, Name: b.Name, Role: string(b.Role), Clinic: b.Clinic, Phone: b.Phone,
	})
	switch {
	case errors.Is(err, health.ErrBlank):
		return CreateCareTeamMember400JSONResponse(errBlankName), nil
	case errors.Is(err, health.ErrNoChild):
		return CreateCareTeamMember404JSONResponse(errNoChild), nil
	case err != nil:
		return nil, err
	}
	return CreateCareTeamMember201JSONResponse(careTeamMust(c)), nil
}

func (s *Server) UpdateCareTeamMember(ctx context.Context, req UpdateCareTeamMemberRequestObject) (UpdateCareTeamMemberResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateCareTeamMember401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateCareTeamMember404JSONResponse(errNoMember), nil
	}
	b := req.Body
	c, err := health.UpdateCareTeamMember(ctx, s.pool, familyID, req.MemberId, health.CareTeamEdit{
		ID: req.CareTeamId, Name: b.Name, Role: string(b.Role), Clinic: b.Clinic, Phone: b.Phone,
	})
	switch {
	case errors.Is(err, health.ErrBlank):
		return UpdateCareTeamMember400JSONResponse(errBlankName), nil
	case errors.Is(err, health.ErrNotFound):
		return UpdateCareTeamMember404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return UpdateCareTeamMember200JSONResponse(careTeamMust(c)), nil
}

func (s *Server) DeleteCareTeamMember(ctx context.Context, req DeleteCareTeamMemberRequestObject) (DeleteCareTeamMemberResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteCareTeamMember401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteCareTeamMember404JSONResponse(errNoMember), nil
	}
	err = health.DeleteCareTeamMember(ctx, s.pool, familyID, req.MemberId, req.CareTeamId)
	switch {
	case errors.Is(err, health.ErrNotFound):
		return DeleteCareTeamMember404JSONResponse(errNoRecord), nil
	case err != nil:
		return nil, err
	}
	return DeleteCareTeamMember204Response{}, nil
}

// careTeamMust is careTeamOut for a row the client just wrote: its role comes
// from the contract enum, so it is always listed.
func careTeamMust(c store.CareTeam) CareTeamMember {
	m, _ := careTeamOut(c)
	return m
}
