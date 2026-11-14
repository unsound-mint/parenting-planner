package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/offers"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var errNoOffer = Error{Code: "not_found", Message: "no such offer in this family"}

// isParent reports whether the member is a mother or partner. Grandparents
// and nannies get 404 on the offer endpoints.
func isParent(m store.Member) bool { return m.Role == "mother" || m.Role == "partner" }

func (s *Server) ListPartnerOffers(ctx context.Context, req ListPartnerOffersRequestObject) (ListPartnerOffersResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListPartnerOffers401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return ListPartnerOffers404JSONResponse(errNoMember), nil
	}
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	// Offers are hidden in pregnancy loss support: the stage is planning then,
	// and planning offers would read as a nudge to try again.
	if fam.PregnancyLossRecordedAt.Valid {
		return ListPartnerOffers200JSONResponse(PartnerOfferList{Items: []PartnerOffer{}}), nil
	}
	// Stage and role only: offers never read health data.
	rows, err := offers.ForParent(ctx, s.pool, familyID, fam.Stage, m.Role)
	if err != nil {
		return nil, err
	}
	out := PartnerOfferList{Items: make([]PartnerOffer, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, partnerOfferOut(r))
	}
	return ListPartnerOffers200JSONResponse(out), nil
}

func (s *Server) CreatePartnerOfferClick(ctx context.Context, req CreatePartnerOfferClickRequestObject) (CreatePartnerOfferClickResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreatePartnerOfferClick401JSONResponse(errNoSession), nil
	case kind == errNotFound || !isParent(m):
		return CreatePartnerOfferClick404JSONResponse(errNoMember), nil
	}
	err = offers.Click(ctx, s.pool, familyID, req.OfferId)
	switch {
	case errors.Is(err, offers.ErrNotFound):
		return CreatePartnerOfferClick404JSONResponse(errNoOffer), nil
	case err != nil:
		return nil, err
	}
	return CreatePartnerOfferClick204Response{}, nil
}

// partnerOfferOut is the parent's view: no click count.
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
