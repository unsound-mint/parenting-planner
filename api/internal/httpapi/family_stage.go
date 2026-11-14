package httpapi

import "context"

// STUB for #214 and #235: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) UpdateFamily(_ context.Context, _ UpdateFamilyRequestObject) (UpdateFamilyResponseObject, error) {
	return UpdateFamily501JSONResponse(Error{Code: "not_implemented", Message: "changing the stage or due date is not available yet"}), nil
}

func (s *Server) CreateBabyArrival(_ context.Context, _ CreateBabyArrivalRequestObject) (CreateBabyArrivalResponseObject, error) {
	return CreateBabyArrival501JSONResponse(Error{Code: "not_implemented", Message: `"Baby is home" is not available yet`}), nil
}
