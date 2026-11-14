package httpapi

import "context"

// STUB for #257: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) ListNotifications(_ context.Context, _ ListNotificationsRequestObject) (ListNotificationsResponseObject, error) {
	return ListNotifications501JSONResponse(Error{Code: "not_implemented", Message: "notifications are not available yet"}), nil
}

func (s *Server) MarkNotificationsRead(_ context.Context, _ MarkNotificationsReadRequestObject) (MarkNotificationsReadResponseObject, error) {
	return MarkNotificationsRead501JSONResponse(Error{Code: "not_implemented", Message: "notifications are not available yet"}), nil
}
