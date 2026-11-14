package httpapi

import "context"

// STUB for #238: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) CreateCareLogEntry(_ context.Context, _ CreateCareLogEntryRequestObject) (CreateCareLogEntryResponseObject, error) {
	return CreateCareLogEntry501JSONResponse(Error{Code: "not_implemented", Message: "the care log is not available yet"}), nil
}

func (s *Server) ListCareLogEntries(_ context.Context, _ ListCareLogEntriesRequestObject) (ListCareLogEntriesResponseObject, error) {
	return ListCareLogEntries501JSONResponse(Error{Code: "not_implemented", Message: "the care log is not available yet"}), nil
}

func (s *Server) CreateHandoff(_ context.Context, _ CreateHandoffRequestObject) (CreateHandoffResponseObject, error) {
	return CreateHandoff501JSONResponse(Error{Code: "not_implemented", Message: "handoffs are not available yet"}), nil
}

func (s *Server) ListHandoffs(_ context.Context, _ ListHandoffsRequestObject) (ListHandoffsResponseObject, error) {
	return ListHandoffs501JSONResponse(Error{Code: "not_implemented", Message: "handoffs are not available yet"}), nil
}

func (s *Server) AcceptHandoff(_ context.Context, _ AcceptHandoffRequestObject) (AcceptHandoffResponseObject, error) {
	return AcceptHandoff501JSONResponse(Error{Code: "not_implemented", Message: "handoffs are not available yet"}), nil
}
