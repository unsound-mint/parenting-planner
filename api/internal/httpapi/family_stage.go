package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/stage"
)

var (
	errDueDateRequired = Error{Code: "due_date_required", Message: "the pregnancy stage needs a due date"}
	errBadDueDate      = Error{Code: "bad_due_date", Message: "the due date must be within the next 42 weeks"}
	errBadBirthDate    = Error{Code: "bad_birth_date", Message: "the birth date must be today or up to 30 days ago"}
	errNotPregnant     = Error{Code: "not_pregnant", Message: "the family is not in the pregnancy stage"}
)

func (s *Server) UpdateFamily(ctx context.Context, req UpdateFamilyRequestObject) (UpdateFamilyResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateFamily401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateFamily404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return UpdateFamily403JSONResponse(errForbidden), nil
	}
	in := stage.Update{}
	if req.Body.Stage != nil {
		v := string(*req.Body.Stage)
		in.Stage = &v
	}
	if req.Body.DueDate != nil {
		in.DueDate = &req.Body.DueDate.Time
	}
	err = stage.UpdateFamily(ctx, s.pool, familyID, m.ID, in, s.today(), s.cfg.Now())
	switch {
	case errors.Is(err, stage.ErrDueDateRequired):
		return UpdateFamily400JSONResponse(errDueDateRequired), nil
	case errors.Is(err, stage.ErrBadDueDate):
		return UpdateFamily400JSONResponse(errBadDueDate), nil
	case errors.Is(err, stage.ErrNoChild):
		return UpdateFamily409JSONResponse(errNoChild), nil
	case err != nil:
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return UpdateFamily200JSONResponse(fam), nil
}

func (s *Server) CreateBabyArrival(ctx context.Context, req CreateBabyArrivalRequestObject) (CreateBabyArrivalResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateBabyArrival401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateBabyArrival404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return CreateBabyArrival403JSONResponse(errForbidden), nil
	}
	err = stage.BabyIsHome(ctx, s.pool, familyID, m.ID, req.Body.Name, req.Body.BirthDate.Time, s.today(), s.cfg.Now())
	switch {
	case errors.Is(err, stage.ErrBadBirthDate):
		return CreateBabyArrival400JSONResponse(errBadBirthDate), nil
	case errors.Is(err, stage.ErrNotPregnant):
		return CreateBabyArrival409JSONResponse(errNotPregnant), nil
	case err != nil:
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return CreateBabyArrival201JSONResponse(fam), nil
}
