package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/supplies"
)

var (
	errNoSupplyItem   = Error{Code: "not_found", Message: "no such supply item"}
	errNoShoppingItem = Error{Code: "not_found", Message: "no such shopping row"}
	errNoSuppliesRole = Error{Code: "forbidden", Message: "you do not have access to the supplies list"}
	errSuppliesParent = Error{Code: "forbidden", Message: "only a parent can change what is at home"}
)

func suppliesPerson(m store.Member) supplies.Person {
	return supplies.Person{ID: m.ID, Role: m.Role, Permissions: m.Permissions}
}

func supplyItemOut(it supplies.Item) SupplyItem {
	out := SupplyItem{
		Id: it.ID, Name: it.Name, Category: SupplyCategory(it.Category), Quantity: int(it.Quantity), Unit: it.Unit,
		LowAt: int(it.LowAt), PerUse: int(it.PerUse), Size: it.Size, Status: SupplyStatus(it.Status), DaysLeft: it.DaysLeft,
		OnShoppingList: it.OnShoppingList,
	}
	if it.ExpiresOn != nil {
		out.ExpiresOn = &openapi_types.Date{Time: *it.ExpiresOn}
	}
	if it.UsagePerDay != nil {
		f := float32(*it.UsagePerDay)
		out.UsagePerDay = &f
	}
	return out
}

func shoppingOut(r store.ShoppingItem) ShoppingItem {
	out := ShoppingItem{Id: r.ID, Name: r.Name, Done: r.DoneAt.Valid, AddedById: r.AddedByMemberID}
	if r.SupplyItemID.Valid {
		out.SupplyItemId = &r.SupplyItemID.UUID
	}
	if r.RestockQuantity.Valid {
		q := int(r.RestockQuantity.Int32)
		out.RestockQuantity = &q
	}
	if r.DoneByMemberID.Valid {
		out.DoneById = &r.DoneByMemberID.UUID
	}
	if r.DoneAt.Valid {
		t := r.DoneAt.Time.UTC()
		out.DoneAt = &t
	}
	return out
}

func newItemOf(b SupplyItemInput) supplies.NewItem {
	in := supplies.NewItem{Name: b.Name, Category: string(b.Category), Quantity: int32(b.Quantity), Unit: "pcs", PerUse: 1, Size: b.Size}
	if b.Unit != nil && *b.Unit != "" {
		in.Unit = *b.Unit
	}
	if b.LowAt != nil {
		in.LowAt = int32(*b.LowAt)
	}
	if b.PerUse != nil {
		in.PerUse = int16(*b.PerUse)
	}
	if b.ExpiresOn != nil {
		t := b.ExpiresOn.Time
		in.ExpiresOn = &t
	}
	return in
}

func (s *Server) GetSupplies(ctx context.Context, req GetSuppliesRequestObject) (GetSuppliesResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetSupplies401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetSupplies404JSONResponse(errNoMember), nil
	case !suppliesPerson(m).CanUse():
		return GetSupplies403JSONResponse(errNoSuppliesRole), nil
	}
	o, err := supplies.Get(ctx, s.pool, familyID, suppliesPerson(m), s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := Supplies{Items: make([]SupplyItem, 0, len(o.Items)), Shopping: make([]ShoppingItem, 0, len(o.Shopping))}
	for _, it := range o.Items {
		out.Items = append(out.Items, supplyItemOut(it))
	}
	for _, r := range o.Shopping {
		out.Shopping = append(out.Shopping, shoppingOut(r))
	}
	if z := o.Sizes; z != nil {
		sz := SizeSuggestion{ChildId: z.ChildID, ChildName: z.ChildName, AgeMonths: z.AgeMonths, Clothing: z.Clothing, Diaper: z.Diaper, Basis: SizeSuggestionBasis(z.Basis), Note: supplies.SizeNote}
		if z.WeightKg != nil {
			w := float32(*z.WeightKg)
			sz.WeightKg = &w
			lb := float32(*z.WeightKg * 2.2046226)
			sz.WeightLb = &lb
		}
		out.Sizes = &sz
	}
	return GetSupplies200JSONResponse(out), nil
}

func (s *Server) CreateSupplyItem(ctx context.Context, req CreateSupplyItemRequestObject) (CreateSupplyItemResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateSupplyItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateSupplyItem404JSONResponse(errNoMember), nil
	case !suppliesPerson(m).IsParent():
		return CreateSupplyItem403JSONResponse(errSuppliesParent), nil
	}
	it, err := supplies.CreateItem(ctx, s.pool, familyID, suppliesPerson(m), newItemOf(*req.Body))
	if err != nil {
		return nil, err
	}
	d, err := supplies.DeriveCreated(ctx, s.pool, familyID, it, s.now(ctx))
	if err != nil {
		return nil, err
	}
	return CreateSupplyItem201JSONResponse(supplyItemOut(d)), nil
}

func (s *Server) UpdateSupplyItem(ctx context.Context, req UpdateSupplyItemRequestObject) (UpdateSupplyItemResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateSupplyItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateSupplyItem404JSONResponse(errNoMember), nil
	case !suppliesPerson(m).IsParent():
		return UpdateSupplyItem403JSONResponse(errSuppliesParent), nil
	}
	d, err := supplies.UpdateItem(ctx, s.pool, familyID, uuid.UUID(req.ItemId), newItemOf(SupplyItemInput(*req.Body)), s.now(ctx))
	if errors.Is(err, supplies.ErrNoItem) {
		return UpdateSupplyItem404JSONResponse(errNoSupplyItem), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateSupplyItem200JSONResponse(supplyItemOut(d)), nil
}

func (s *Server) DeleteSupplyItem(ctx context.Context, req DeleteSupplyItemRequestObject) (DeleteSupplyItemResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteSupplyItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteSupplyItem404JSONResponse(errNoMember), nil
	case !suppliesPerson(m).IsParent():
		return DeleteSupplyItem403JSONResponse(errSuppliesParent), nil
	}
	if err := supplies.DeleteItem(ctx, s.pool, familyID, uuid.UUID(req.ItemId)); errors.Is(err, supplies.ErrNoItem) {
		return DeleteSupplyItem404JSONResponse(errNoSupplyItem), nil
	} else if err != nil {
		return nil, err
	}
	return DeleteSupplyItem204Response{}, nil
}

func (s *Server) CreateShoppingItem(ctx context.Context, req CreateShoppingItemRequestObject) (CreateShoppingItemResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateShoppingItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateShoppingItem404JSONResponse(errNoMember), nil
	case !suppliesPerson(m).CanUse():
		return CreateShoppingItem403JSONResponse(errNoSuppliesRole), nil
	}
	b := req.Body
	in := supplies.NewShopping{Name: b.Name}
	if b.SupplyItemId != nil {
		id := uuid.UUID(*b.SupplyItemId)
		in.SupplyItemID = &id
	}
	if b.RestockQuantity != nil {
		v := int32(*b.RestockQuantity)
		in.Restock = &v
	}
	r, err := supplies.CreateShopping(ctx, s.pool, familyID, suppliesPerson(m), in)
	if errors.Is(err, supplies.ErrNoItem) {
		return CreateShoppingItem404JSONResponse(errNoSupplyItem), nil
	}
	if err != nil {
		return nil, err
	}
	return CreateShoppingItem201JSONResponse(shoppingOut(r)), nil
}

func (s *Server) UpdateShoppingItem(ctx context.Context, req UpdateShoppingItemRequestObject) (UpdateShoppingItemResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateShoppingItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateShoppingItem404JSONResponse(errNoMember), nil
	case !suppliesPerson(m).CanUse():
		return UpdateShoppingItem403JSONResponse(errNoSuppliesRole), nil
	}
	r, err := supplies.SetDone(ctx, s.pool, familyID, suppliesPerson(m), uuid.UUID(req.ItemId), req.Body.Done, s.now(ctx))
	if errors.Is(err, supplies.ErrNoShopping) {
		return UpdateShoppingItem404JSONResponse(errNoShoppingItem), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateShoppingItem200JSONResponse(shoppingOut(r)), nil
}

func (s *Server) DeleteShoppingItem(ctx context.Context, req DeleteShoppingItemRequestObject) (DeleteShoppingItemResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteShoppingItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteShoppingItem404JSONResponse(errNoMember), nil
	case !suppliesPerson(m).IsParent():
		return DeleteShoppingItem403JSONResponse(errSuppliesParent), nil
	}
	if err := supplies.DeleteShopping(ctx, s.pool, familyID, uuid.UUID(req.ItemId)); errors.Is(err, supplies.ErrNoShopping) {
		return DeleteShoppingItem404JSONResponse(errNoShoppingItem), nil
	} else if err != nil {
		return nil, err
	}
	return DeleteShoppingItem204Response{}, nil
}

func (s *Server) GetMemberPreferences(ctx context.Context, req GetMemberPreferencesRequestObject) (GetMemberPreferencesResponseObject, error) {
	_, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetMemberPreferences401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetMemberPreferences404JSONResponse(errNoMember), nil
	}
	return GetMemberPreferences200JSONResponse{EssentialsOnly: m.EssentialsOnly}, nil
}

func (s *Server) UpdateMemberPreferences(ctx context.Context, req UpdateMemberPreferencesRequestObject) (UpdateMemberPreferencesResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateMemberPreferences401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateMemberPreferences404JSONResponse(errNoMember), nil
	}
	if err := supplies.SetEssentialsOnly(ctx, s.pool, familyID, req.MemberId, req.Body.EssentialsOnly); err != nil {
		return nil, err
	}
	return UpdateMemberPreferences200JSONResponse{EssentialsOnly: req.Body.EssentialsOnly}, nil
}
