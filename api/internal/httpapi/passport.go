package httpapi

import "context"

// STUB for #172: the contract is in openapi.yaml, the implementation is not
// written yet. Replace this file with real handlers (copy wellbeing.go) and
// remove the 501 response from openapi.yaml. The web screen shows an empty
// state on 501.
func (s *Server) GetPassport(ctx context.Context, req GetPassportRequestObject) (GetPassportResponseObject, error) {
	return GetPassport501JSONResponse(Error{Code: "not_implemented", Message: "the health passport is not available yet"}), nil
}
