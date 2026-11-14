package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/childcare"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// The childcare tracker is family-wide: either parent of the session's family
// reads and edits it (managingFamily); a caregiver's session gets 403.

func childcareOptionOut(o store.ChildcareOption) ChildcareOption {
	out := ChildcareOption{
		Id: o.ID, Name: o.Name, Kind: ChildcareKind(o.Kind), Contact: o.Contact, Status: ChildcareStatus(o.Status),
		Notes: o.Notes, UpdatedAt: o.UpdatedAt.UTC(),
	}
	if o.MonthlyCost.Valid {
		v := int(o.MonthlyCost.Int32)
		out.MonthlyCost = &v
	}
	if o.WaitlistPosition.Valid {
		v := int(o.WaitlistPosition.Int32)
		out.WaitlistPosition = &v
	}
	if o.AppliedOn != nil {
		out.AppliedOn = &openapi_types.Date{Time: *o.AppliedOn}
	}
	if o.DecideBy != nil {
		out.DecideBy = &openapi_types.Date{Time: *o.DecideBy}
	}
	return out
}

func childcareInput(b *ChildcareOptionInput) childcare.Input {
	in := childcare.Input{
		Name: b.Name, Kind: string(b.Kind), Contact: b.Contact, MonthlyCost: b.MonthlyCost, Status: string(b.Status),
		WaitlistPosition: b.WaitlistPosition, Notes: b.Notes,
	}
	if b.AppliedOn != nil {
		in.AppliedOn = &b.AppliedOn.Time
	}
	if b.DecideBy != nil {
		in.DecideBy = &b.DecideBy.Time
	}
	return in
}

func (s *Server) ListChildcareOptions(ctx context.Context, _ ListChildcareOptionsRequestObject) (ListChildcareOptionsResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return ListChildcareOptions401JSONResponse(errNoSession), nil
	case errNotParent:
		return ListChildcareOptions403JSONResponse(errForbidden), nil
	}
	rows, err := childcare.List(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	out := ChildcareOptionList{Items: make([]ChildcareOption, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, childcareOptionOut(r))
	}
	return ListChildcareOptions200JSONResponse(out), nil
}

func (s *Server) CreateChildcareOption(ctx context.Context, req CreateChildcareOptionRequestObject) (CreateChildcareOptionResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return CreateChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return CreateChildcareOption403JSONResponse(errForbidden), nil
	}
	o, err := childcare.Create(ctx, s.pool, familyID, childcareInput(req.Body), s.now(ctx))
	if err != nil {
		return nil, err
	}
	return CreateChildcareOption201JSONResponse(childcareOptionOut(o)), nil
}

func (s *Server) GetChildcareOption(ctx context.Context, req GetChildcareOptionRequestObject) (GetChildcareOptionResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return GetChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return GetChildcareOption403JSONResponse(errForbidden), nil
	}
	o, err := childcare.Get(ctx, s.pool, familyID, req.OptionId)
	if errors.Is(err, childcare.ErrNotFound) {
		return GetChildcareOption404JSONResponse(errNoChildcareOption), nil
	}
	if err != nil {
		return nil, err
	}
	return GetChildcareOption200JSONResponse(childcareOptionOut(o)), nil
}

func (s *Server) UpdateChildcareOption(ctx context.Context, req UpdateChildcareOptionRequestObject) (UpdateChildcareOptionResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return UpdateChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return UpdateChildcareOption403JSONResponse(errForbidden), nil
	}
	o, err := childcare.Update(ctx, s.pool, familyID, req.OptionId, childcareInput(req.Body), s.now(ctx))
	if errors.Is(err, childcare.ErrNotFound) {
		return UpdateChildcareOption404JSONResponse(errNoChildcareOption), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateChildcareOption200JSONResponse(childcareOptionOut(o)), nil
}

func (s *Server) DeleteChildcareOption(ctx context.Context, req DeleteChildcareOptionRequestObject) (DeleteChildcareOptionResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return DeleteChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return DeleteChildcareOption403JSONResponse(errForbidden), nil
	}
	err := childcare.Delete(ctx, s.pool, familyID, req.OptionId)
	if errors.Is(err, childcare.ErrNotFound) {
		return DeleteChildcareOption404JSONResponse(errNoChildcareOption), nil
	}
	if err != nil {
		return nil, err
	}
	return DeleteChildcareOption204Response{}, nil
}
