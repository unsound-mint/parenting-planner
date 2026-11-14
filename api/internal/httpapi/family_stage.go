package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/family"
)

// UpdateFamily is built (#214). CreateBabyArrival below is still a STUB for
// #235: replace it with a real handler and its test.

func (s *Server) UpdateFamily(ctx context.Context, req UpdateFamilyRequestObject) (UpdateFamilyResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateFamily401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateFamily404JSONResponse(errNoMember), nil
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
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return UpdateFamily200JSONResponse(fam), nil
}

func (s *Server) CreateBabyArrival(_ context.Context, _ CreateBabyArrivalRequestObject) (CreateBabyArrivalResponseObject, error) {
	return CreateBabyArrival501JSONResponse(Error{Code: "not_implemented", Message: `"Baby is home" is not available yet`}), nil
}
