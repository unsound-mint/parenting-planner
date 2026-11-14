package httpapi

import "context"

// STUB for #297: the contract is in openapi.yaml, the implementation is
// not written yet. Replace the stub with a real handler (copy plan.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) GetMemberJourney(_ context.Context, _ GetMemberJourneyRequestObject) (GetMemberJourneyResponseObject, error) {
	return GetMemberJourney501JSONResponse(Error{Code: "not_implemented", Message: "the journey timeline is not available yet"}), nil
}
