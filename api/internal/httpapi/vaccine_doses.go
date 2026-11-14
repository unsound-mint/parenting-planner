package httpapi

import "context"

// STUB for #300: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) UpdateVaccineDose(_ context.Context, _ UpdateVaccineDoseRequestObject) (UpdateVaccineDoseResponseObject, error) {
	return UpdateVaccineDose501JSONResponse(Error{Code: "not_implemented", Message: "recording vaccine doses is not available yet"}), nil
}
