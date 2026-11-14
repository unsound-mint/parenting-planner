package httpapi

import "context"

// STUB for #267: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) CreateInsuranceCall(_ context.Context, _ CreateInsuranceCallRequestObject) (CreateInsuranceCallResponseObject, error) {
	return CreateInsuranceCall501JSONResponse(Error{Code: "not_implemented", Message: "the insurance call log is not available yet"}), nil
}

func (s *Server) ListInsuranceCalls(_ context.Context, _ ListInsuranceCallsRequestObject) (ListInsuranceCallsResponseObject, error) {
	return ListInsuranceCalls501JSONResponse(Error{Code: "not_implemented", Message: "the insurance call log is not available yet"}), nil
}
