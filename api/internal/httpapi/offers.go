package httpapi

import "context"

// STUB for #282: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) ListPartnerOffers(_ context.Context, _ ListPartnerOffersRequestObject) (ListPartnerOffersResponseObject, error) {
	return ListPartnerOffers501JSONResponse(Error{Code: "not_implemented", Message: "partner offers are not available yet"}), nil
}

func (s *Server) CreatePartnerOfferClick(_ context.Context, _ CreatePartnerOfferClickRequestObject) (CreatePartnerOfferClickResponseObject, error) {
	return CreatePartnerOfferClick501JSONResponse(Error{Code: "not_implemented", Message: "partner offers are not available yet"}), nil
}
