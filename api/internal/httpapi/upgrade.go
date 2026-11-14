package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
)

// Stub until the backend lands (#176): the contract exists, the behaviour does not.
type createUpgradeIntent501Response Error

func (r createUpgradeIntent501Response) VisitCreateUpgradeIntentResponse(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	return json.NewEncoder(w).Encode(Error(r))
}

func (s *Server) CreateUpgradeIntent(_ context.Context, _ CreateUpgradeIntentRequestObject) (CreateUpgradeIntentResponseObject, error) {
	return createUpgradeIntent501Response(Error{Code: "not_implemented", Message: "upgrade intents are not stored yet"}), nil
}
