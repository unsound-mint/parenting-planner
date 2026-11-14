package httpapi

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var errNoOffer = Error{Code: "not_found", Message: "no such offer"}

func partnerOfferOut(o store.PartnerOffer) PartnerOffer {
	out := PartnerOffer{
		Id: o.ID, PartnerName: o.PartnerName, Title: o.Title, Detail: o.Detail, Url: o.Url, Active: o.Active,
		Stages: make([]Stage, 0, len(o.Stages)), Audience: make([]ParentRole, 0, len(o.Audience)),
	}
	for _, st := range o.Stages {
		out.Stages = append(out.Stages, Stage(st))
	}
	for _, a := range o.Audience {
		out.Audience = append(out.Audience, ParentRole(a))
	}
	return out
}

// ListPartnerOffers returns up to three active offers that match the family's
// stage and the parent's role. Stage and role only: never health data. Empty
// while the family is in pregnancy loss support.
func (s *Server) ListPartnerOffers(ctx context.Context, req ListPartnerOffersRequestObject) (ListPartnerOffersResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListPartnerOffers401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListPartnerOffers404JSONResponse(errNoMember), nil
	}
	out := PartnerOfferList{Items: []PartnerOffer{}}
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	if fam.PregnancyLossRecordedAt.Valid {
		return ListPartnerOffers200JSONResponse(out), nil
	}
	rows, err := s.q.ListMatchingPartnerOffers(ctx, store.ListMatchingPartnerOffersParams{FamilyID: familyID, Stage: fam.Stage, Role: m.Role})
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out.Items = append(out.Items, partnerOfferOut(r))
	}
	return ListPartnerOffers200JSONResponse(out), nil
}

// CreatePartnerOfferClick counts a click: only the offer, the family and the time.
func (s *Server) CreatePartnerOfferClick(ctx context.Context, req CreatePartnerOfferClickRequestObject) (CreatePartnerOfferClickResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreatePartnerOfferClick401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreatePartnerOfferClick404JSONResponse(errNoMember), nil
	}
	if _, err := s.q.GetPartnerOffer(ctx, store.GetPartnerOfferParams{ID: req.OfferId, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
		return CreatePartnerOfferClick404JSONResponse(errNoOffer), nil
	} else if err != nil {
		return nil, err
	}
	if err := s.q.CreatePartnerOfferClick(ctx, store.CreatePartnerOfferClickParams{OfferID: req.OfferId, FamilyID: familyID, ClickedAt: s.now(ctx)}); err != nil {
		return nil, err
	}
	return CreatePartnerOfferClick204Response{}, nil
}
