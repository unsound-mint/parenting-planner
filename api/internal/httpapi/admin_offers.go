package httpapi

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// There is no admin login: every visitor operates their own sandbox, so these
// endpoints only ever touch the session's family (the contract says so).

func stagesOf(in []Stage) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		out = append(out, string(s))
	}
	return out
}

func rolesOf(in []ParentRole) []string {
	out := make([]string, 0, len(in))
	for _, r := range in {
		out = append(out, string(r))
	}
	return out
}

func (s *Server) ListAllPartnerOffers(ctx context.Context, _ ListAllPartnerOffersRequestObject) (ListAllPartnerOffersResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return ListAllPartnerOffers401JSONResponse(errNoSession), nil
	}
	rows, err := s.q.ListAllPartnerOffersWithClicks(ctx, familyID)
	if err != nil {
		return nil, err
	}
	out := PartnerOfferList{Items: make([]PartnerOffer, 0, len(rows))}
	for _, r := range rows {
		o := partnerOfferOut(store.PartnerOffer{
			ID: r.ID, FamilyID: r.FamilyID, PartnerName: r.PartnerName, Title: r.Title, Detail: r.Detail, Url: r.Url,
			Stages: r.Stages, Audience: r.Audience, Active: r.Active,
		})
		n := int(r.Clicks)
		o.Clicks = &n
		out.Items = append(out.Items, o)
	}
	return ListAllPartnerOffers200JSONResponse(out), nil
}

func (s *Server) CreatePartnerOffer(ctx context.Context, req CreatePartnerOfferRequestObject) (CreatePartnerOfferResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return CreatePartnerOffer401JSONResponse(errNoSession), nil
	}
	b := req.Body
	o, err := s.q.CreatePartnerOffer(ctx, store.CreatePartnerOfferParams{
		FamilyID: familyID, PartnerName: b.PartnerName, Title: b.Title, Detail: b.Detail, Url: b.Url,
		Stages: stagesOf(b.Stages), Audience: rolesOf(b.Audience), Active: b.Active,
	})
	if err != nil {
		return nil, err
	}
	out := partnerOfferOut(o)
	zero := 0
	out.Clicks = &zero
	return CreatePartnerOffer201JSONResponse(out), nil
}

func (s *Server) UpdatePartnerOffer(ctx context.Context, req UpdatePartnerOfferRequestObject) (UpdatePartnerOfferResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return UpdatePartnerOffer401JSONResponse(errNoSession), nil
	}
	b := req.Body
	p := store.UpdatePartnerOfferParams{ID: req.OfferId, FamilyID: familyID, PartnerName: b.PartnerName, Title: b.Title, Detail: b.Detail, Url: b.Url}
	if b.Stages != nil {
		p.Stages = stagesOf(*b.Stages)
	}
	if b.Audience != nil {
		p.Audience = rolesOf(*b.Audience)
	}
	if b.Active != nil {
		p.Active = pgtype.Bool{Bool: *b.Active, Valid: true}
	}
	o, err := s.q.UpdatePartnerOffer(ctx, p)
	if errors.Is(err, pgx.ErrNoRows) {
		return UpdatePartnerOffer404JSONResponse(errNoOffer), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdatePartnerOffer200JSONResponse(partnerOfferOut(o)), nil
}
