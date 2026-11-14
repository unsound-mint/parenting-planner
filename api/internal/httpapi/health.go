package httpapi

import "context"

// STUB for #378: the contract is in openapi.yaml, the implementation is not
// written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test.

func (s *Server) CreateImmunization(_ context.Context, _ CreateImmunizationRequestObject) (CreateImmunizationResponseObject, error) {
	return CreateImmunization501JSONResponse(Error{Code: "not_implemented", Message: "logging vaccines is not available yet"}), nil
}

func (s *Server) CreateScreening(_ context.Context, _ CreateScreeningRequestObject) (CreateScreeningResponseObject, error) {
	return CreateScreening501JSONResponse(Error{Code: "not_implemented", Message: "logging screenings is not available yet"}), nil
}

func (s *Server) CreateLabResult(_ context.Context, _ CreateLabResultRequestObject) (CreateLabResultResponseObject, error) {
	return CreateLabResult501JSONResponse(Error{Code: "not_implemented", Message: "logging lab results is not available yet"}), nil
}
