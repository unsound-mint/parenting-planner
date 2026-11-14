package httpapi

import "context"

// STUB for #214 and #217: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) ListGuides(_ context.Context, _ ListGuidesRequestObject) (ListGuidesResponseObject, error) {
	return ListGuides501JSONResponse(Error{Code: "not_implemented", Message: "stage guides are not available yet"}), nil
}

func (s *Server) GetPregnancyWeek(_ context.Context, _ GetPregnancyWeekRequestObject) (GetPregnancyWeekResponseObject, error) {
	return GetPregnancyWeek501JSONResponse(Error{Code: "not_implemented", Message: "weekly pregnancy cards are not available yet"}), nil
}
