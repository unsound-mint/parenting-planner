package httpapi

import "context"

// STUB for #211: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) CreateInvitation(_ context.Context, _ CreateInvitationRequestObject) (CreateInvitationResponseObject, error) {
	return CreateInvitation501JSONResponse(Error{Code: "not_implemented", Message: "invitations are not available yet"}), nil
}

func (s *Server) ListInvitations(_ context.Context, _ ListInvitationsRequestObject) (ListInvitationsResponseObject, error) {
	return ListInvitations501JSONResponse(Error{Code: "not_implemented", Message: "invitations are not available yet"}), nil
}

func (s *Server) RevokeInvitation(_ context.Context, _ RevokeInvitationRequestObject) (RevokeInvitationResponseObject, error) {
	return RevokeInvitation501JSONResponse(Error{Code: "not_implemented", Message: "invitations are not available yet"}), nil
}

func (s *Server) GetInvitation(_ context.Context, _ GetInvitationRequestObject) (GetInvitationResponseObject, error) {
	return GetInvitation501JSONResponse(Error{Code: "not_implemented", Message: "invitations are not available yet"}), nil
}

func (s *Server) AcceptInvitation(_ context.Context, _ AcceptInvitationRequestObject) (AcceptInvitationResponseObject, error) {
	return AcceptInvitation501JSONResponse(Error{Code: "not_implemented", Message: "invitations are not available yet"}), nil
}

func (s *Server) ListAccessLogEntries(_ context.Context, _ ListAccessLogEntriesRequestObject) (ListAccessLogEntriesResponseObject, error) {
	return ListAccessLogEntries501JSONResponse(Error{Code: "not_implemented", Message: "the access log is not available yet"}), nil
}
