package httpapi

import "context"

// STUB for #220: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) GetToday(_ context.Context, _ GetTodayRequestObject) (GetTodayResponseObject, error) {
	return GetToday501JSONResponse(Error{Code: "not_implemented", Message: "the Today screen is not available yet"}), nil
}
