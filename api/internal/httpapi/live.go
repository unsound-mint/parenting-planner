package httpapi

import "context"

// STUB for #241: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) GetLiveUpdates(_ context.Context, _ GetLiveUpdatesRequestObject) (GetLiveUpdatesResponseObject, error) {
	return GetLiveUpdates501JSONResponse(Error{Code: "not_implemented", Message: "live updates are not available yet"}), nil
}
