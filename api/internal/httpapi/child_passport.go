package httpapi

import "context"

// STUB for #244: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) GetChildPassport(_ context.Context, _ GetChildPassportRequestObject) (GetChildPassportResponseObject, error) {
	return GetChildPassport501JSONResponse(Error{Code: "not_implemented", Message: "the baby passport is not available yet"}), nil
}
