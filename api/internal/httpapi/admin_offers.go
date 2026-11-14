package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/offers"
)

// The admin has no login (see openapi.yaml): every handler works on the
// session's own family copy, so a visitor never changes what another sees.

func (s *Server) ListAllPartnerOffers(ctx context.Context, _ ListAllPartnerOffersRequestObject) (ListAllPartnerOffersResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return ListAllPartnerOffers401JSONResponse(errNoSession), nil
	case errNotParent:
		return ListAllPartnerOffers403JSONResponse(errForbidden), nil
	}
	rows, err := offers.All(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	out := PartnerOfferList{Items: make([]PartnerOffer, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, adminOfferOut(r))
	}
	return ListAllPartnerOffers200JSONResponse(out), nil
}

func (s *Server) CreatePartnerOffer(ctx context.Context, req CreatePartnerOfferRequestObject) (CreatePartnerOfferResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return CreatePartnerOffer401JSONResponse(errNoSession), nil
	case errNotParent:
		return CreatePartnerOffer403JSONResponse(errForbidden), nil
	}
	b := req.Body
	o, err := offers.Create(ctx, s.pool, familyID, offers.NewOffer{
		PartnerName: b.PartnerName, Title: b.Title, Detail: b.Detail, URL: b.Url,
		Stages: stageStrings(b.Stages), Audience: roleStrings(b.Audience), Active: b.Active,
	}, s.now(ctx))
	if err != nil {
		return nil, err
	}
	return CreatePartnerOffer201JSONResponse(adminOfferOut(offers.Offer{PartnerOffer: o})), nil
}

func (s *Server) UpdatePartnerOffer(ctx context.Context, req UpdatePartnerOfferRequestObject) (UpdatePartnerOfferResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return UpdatePartnerOffer401JSONResponse(errNoSession), nil
	case errNotParent:
		return UpdatePartnerOffer403JSONResponse(errForbidden), nil
	}
	b := req.Body
	c := offers.Change{PartnerName: b.PartnerName, Title: b.Title, Detail: b.Detail, URL: b.Url, Active: b.Active}
	if b.Stages != nil {
		c.Stages = stageStrings(*b.Stages)
	}
	if b.Audience != nil {
		c.Audience = roleStrings(*b.Audience)
	}
	o, err := offers.Update(ctx, s.pool, familyID, req.OfferId, c, s.now(ctx))
	switch {
	case errors.Is(err, offers.ErrNotFound):
		return UpdatePartnerOffer404JSONResponse(errNoOffer), nil
	case err != nil:
		return nil, err
	}
	return UpdatePartnerOffer200JSONResponse(adminOfferOut(o)), nil
}

// adminOfferOut is the admin's view, with the aggregate click count.
func adminOfferOut(o offers.Offer) PartnerOffer {
	out := partnerOfferOut(o.PartnerOffer)
	clicks := o.Clicks
	out.Clicks = &clicks
	return out
}

func stageStrings(in []Stage) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		out = append(out, string(s))
	}
	return out
}

func roleStrings(in []ParentRole) []string {
	out := make([]string, 0, len(in))
	for _, r := range in {
		out = append(out, string(r))
	}
	return out
}
