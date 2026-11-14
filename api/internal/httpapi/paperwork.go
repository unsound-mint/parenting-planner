package httpapi

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/paperwork"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// anchorDate is the first child's birth date if there is one, else the due date.
func (s *Server) anchorDate(ctx context.Context, familyID uuid.UUID) (time.Time, paperwork.Anchor, bool, error) {
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return time.Time{}, "", false, err
	}
	children, err := s.q.ListChildren(ctx, familyID)
	if err != nil {
		return time.Time{}, "", false, err
	}
	var birth *time.Time
	if len(children) > 0 {
		birth = &children[0].BirthDate // ordered by birth date
	}
	a, kind, ok := paperwork.PickAnchor(birth, fam.DueDate)
	return a, kind, ok, nil
}

func (s *Server) paperworkOut(it paperwork.Item, row *store.PaperworkItem, anchor time.Time, kind paperwork.Anchor, ok bool) PaperworkItem {
	out := PaperworkItem{
		Key: PaperworkKey(it.Key), Title: it.Title, Detail: it.Detail,
		Source: Source{Title: it.Source.Title, Url: it.Source.URL, CheckedAt: openapi_types.Date{Time: it.Source.CheckedAt}},
	}
	if row != nil {
		out.Done = row.Done
		if row.AssigneeMemberID.Valid {
			id := row.AssigneeMemberID.UUID
			out.OwnerMemberId = &id
		}
	}
	out.Status = PaperworkItemStatusUpcoming
	if ok {
		dl := paperwork.Deadline(it, anchor)
		out.Deadline = &openapi_types.Date{Time: dl}
		b := PaperworkItemDeadlineBasedOn(kind)
		out.DeadlineBasedOn = &b
		out.Status = PaperworkItemStatus(paperwork.StatusOf(out.Done, dl, s.today()))
	} else if out.Done {
		out.Status = PaperworkItemStatusDone
	}
	return out
}

func (s *Server) ListPaperwork(ctx context.Context, _ ListPaperworkRequestObject) (ListPaperworkResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return ListPaperwork401JSONResponse(errNoSession), nil
	}
	anchor, kind, hasAnchor, err := s.anchorDate(ctx, familyID)
	if err != nil {
		return nil, err
	}
	rows, err := s.q.ListPaperworkItems(ctx, familyID)
	if err != nil {
		return nil, err
	}
	byKey := map[string]store.PaperworkItem{}
	for _, r := range rows {
		byKey[r.Key] = r
	}
	items := make([]PaperworkItem, 0, len(paperwork.Catalog))
	for _, it := range paperwork.Catalog {
		var row *store.PaperworkItem
		if r, found := byKey[it.Key]; found {
			row = &r
		}
		items = append(items, s.paperworkOut(it, row, anchor, kind, hasAnchor))
	}
	return ListPaperwork200JSONResponse{Items: items}, nil
}

func (s *Server) UpdatePaperwork(ctx context.Context, req UpdatePaperworkRequestObject) (UpdatePaperworkResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return UpdatePaperwork401JSONResponse(errNoSession), nil
	}
	b := req.Body
	p := store.UpsertPaperworkItemParams{FamilyID: familyID, Key: string(req.Key)}
	if b.Done != nil {
		p.Done = pgtype.Bool{Bool: *b.Done, Valid: true}
	}
	if b.OwnerMemberId != nil {
		if ok, err := s.isParent(ctx, familyID, *b.OwnerMemberId); err != nil {
			return nil, err
		} else if !ok {
			return UpdatePaperwork400JSONResponse(errBadOwner), nil
		}
		p.AssigneeMemberID = uuid.NullUUID{UUID: *b.OwnerMemberId, Valid: true}
	}
	row, err := s.q.UpsertPaperworkItem(ctx, p)
	if err != nil {
		return nil, err
	}
	anchor, kind, hasAnchor, err := s.anchorDate(ctx, familyID)
	if err != nil {
		return nil, err
	}
	for _, it := range paperwork.Catalog {
		if it.Key == string(req.Key) {
			return UpdatePaperwork200JSONResponse(s.paperworkOut(it, &row, anchor, kind, hasAnchor)), nil
		}
	}
	return nil, nil
}

func (s *Server) UpdateFamily(ctx context.Context, req UpdateFamilyRequestObject) (UpdateFamilyResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return UpdateFamily401JSONResponse(errNoSession), nil
	}
	due := req.Body.DueDate.Time
	// A due date more than 42 weeks away or more than 2 weeks past is a typo, not a pregnancy.
	if due.After(s.today().AddDate(0, 0, 7*42)) || due.Before(s.today().AddDate(0, 0, -14)) {
		return UpdateFamily400JSONResponse(Error{Code: "bad_due_date", Message: "the due date must be within the next 42 weeks"}), nil
	}
	if _, err := s.q.UpdateFamilyDueDate(ctx, store.UpdateFamilyDueDateParams{ID: familyID, DueDate: &due}); err != nil {
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return UpdateFamily200JSONResponse(fam), nil
}
