package httpapi

import (
	"context"
	"errors"

<<<<<<< HEAD
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
=======
	"github.com/unsound-mint/parenting-planner/api/internal/family"
)

// UpdateFamily is built (#214). CreateBabyArrival below is still a STUB for
// #235: replace it with a real handler and its test.

func (s *Server) UpdateFamily(ctx context.Context, req UpdateFamilyRequestObject) (UpdateFamilyResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
>>>>>>> 238-care-log
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateFamily401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateFamily404JSONResponse(errNoMember), nil
<<<<<<< HEAD
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
=======
	}
	// Parents only. Caregivers cannot be resolved here yet; once they are
	// members, this is the check that answers them with 403.
	if m.Role != string(ParentRoleMother) && m.Role != string(ParentRolePartner) {
		return UpdateFamily403JSONResponse(errForbidden), nil
	}
	var ch family.Change
	if b := req.Body; b != nil {
		if b.Stage != nil {
			st := string(*b.Stage)
			ch.Stage = &st
		}
		if b.DueDate != nil {
			d := b.DueDate.Time
			ch.DueDate = &d
		}
	}
	if _, err := family.Update(ctx, s.pool, familyID, req.MemberId, ch, s.today()); err != nil {
		switch {
		case errors.Is(err, family.ErrNoChild):
			return UpdateFamily409JSONResponse(Error{Code: "no_child", Message: err.Error()}), nil
		case errors.Is(err, family.ErrDueDateRequired), errors.Is(err, family.ErrDueDateNotAllowed), errors.Is(err, family.ErrDueDateRange):
			return UpdateFamily400JSONResponse(Error{Code: "invalid_request", Message: err.Error()}), nil
		}
>>>>>>> 238-care-log
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
