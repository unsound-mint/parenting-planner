package httpapi

import "context"

// STUB for #322: the contract is in openapi.yaml, the implementation is not
// written yet. Replace it with a real handler next to CreateDemoSession and
// replace its test. The web hides "Try it with your own details" on 501.

func (s *Server) CreateCustomSession(_ context.Context, _ CreateCustomSessionRequestObject) (CreateCustomSessionResponseObject, error) {
	return CreateCustomSession501JSONResponse(Error{Code: "not_implemented", Message: "starting with your own details is not available yet"}), nil
}
