package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var errBadOwner = Error{Code: "bad_owner", Message: "the owner must be a parent in this family"}

func bagItemOut(i store.BagItem) BagItem {
	out := BagItem{Id: i.ID, List: BagList(i.List), Label: i.Label, Packed: i.Packed}
	if i.PackerMemberID.Valid {
		id := i.PackerMemberID.UUID
		out.OwnerMemberId = &id
	}
	return out
}

// isParent reports whether id is a parent of the family. Owners come from the body, so they are checked.
func (s *Server) isParent(ctx context.Context, familyID, id uuid.UUID) (bool, error) {
	_, err := s.q.GetMember(ctx, store.GetMemberParams{ID: id, FamilyID: familyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *Server) CreateBagItem(ctx context.Context, req CreateBagItemRequestObject) (CreateBagItemResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return CreateBagItem401JSONResponse(errNoSession), nil
	}
	b := req.Body
	owner := uuid.NullUUID{}
	if b.OwnerMemberId != nil {
		if ok, err := s.isParent(ctx, familyID, *b.OwnerMemberId); err != nil {
			return nil, err
		} else if !ok {
			return CreateBagItem400JSONResponse(errBadOwner), nil
		}
		owner = uuid.NullUUID{UUID: *b.OwnerMemberId, Valid: true}
	}
	item, err := s.q.CreateBagItem(ctx, store.CreateBagItemParams{FamilyID: familyID, List: string(b.List), Label: b.Label, PackerMemberID: owner})
	if err != nil {
		return nil, err
	}
	return CreateBagItem201JSONResponse(bagItemOut(item)), nil
}

func (s *Server) ListBagItems(ctx context.Context, _ ListBagItemsRequestObject) (ListBagItemsResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return ListBagItems401JSONResponse(errNoSession), nil
	}
	rows, err := s.q.ListBagItems(ctx, familyID)
	if err != nil {
		return nil, err
	}
	items := make([]BagItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, bagItemOut(r))
	}
	return ListBagItems200JSONResponse{Items: items}, nil
}

func (s *Server) UpdateBagItem(ctx context.Context, req UpdateBagItemRequestObject) (UpdateBagItemResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return UpdateBagItem401JSONResponse(errNoSession), nil
	}
	b := req.Body
	p := store.UpdateBagItemParams{ID: req.ItemId, FamilyID: familyID}
	if b.Packed != nil {
		p.Packed = pgtype.Bool{Bool: *b.Packed, Valid: true}
	}
	if b.OwnerMemberId != nil {
		if ok, err := s.isParent(ctx, familyID, *b.OwnerMemberId); err != nil {
			return nil, err
		} else if !ok {
			return UpdateBagItem400JSONResponse(errBadOwner), nil
		}
		p.PackerMemberID = uuid.NullUUID{UUID: *b.OwnerMemberId, Valid: true}
	}
	item, err := s.q.UpdateBagItem(ctx, p)
	if errors.Is(err, pgx.ErrNoRows) {
		return UpdateBagItem404JSONResponse(Error{Code: "not_found", Message: "no such bag item"}), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateBagItem200JSONResponse(bagItemOut(item)), nil
}
