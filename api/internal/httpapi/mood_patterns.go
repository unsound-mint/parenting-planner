package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
)

// notImplemented is a 501 response that is not in the contract on purpose: the
// route is a stub until the pattern detection lands (#173).
type notImplemented Error

func (r notImplemented) VisitListMoodPatternsResponse(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	return json.NewEncoder(w).Encode(Error(r))
}

// ListMoodPatterns is a stub: the frontend is built against the contract and
// shows an empty state while this returns 501. Replace with the real handler.
func (s *Server) ListMoodPatterns(ctx context.Context, req ListMoodPatternsRequestObject) (ListMoodPatternsResponseObject, error) {
	return notImplemented{Code: "not_implemented", Message: "mood patterns are not available yet"}, nil
}
