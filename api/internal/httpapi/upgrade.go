package httpapi

import "context"

// Stub until the backend lands (#176): the contract exists, the behaviour does not.
func (s *Server) CreateUpgradeIntent(_ context.Context, _ CreateUpgradeIntentRequestObject) (CreateUpgradeIntentResponseObject, error) {
	return CreateUpgradeIntent501JSONResponse(Error{Code: "not_implemented", Message: "upgrade intents are not stored yet"}), nil
}
