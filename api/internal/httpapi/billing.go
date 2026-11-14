package httpapi

import "context"

// STUB for #25: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) CreateCheckoutSession(_ context.Context, _ CreateCheckoutSessionRequestObject) (CreateCheckoutSessionResponseObject, error) {
	return CreateCheckoutSession501JSONResponse(Error{Code: "not_implemented", Message: "payments are not available yet"}), nil
}

func (s *Server) GetCheckoutSession(_ context.Context, _ GetCheckoutSessionRequestObject) (GetCheckoutSessionResponseObject, error) {
	return GetCheckoutSession501JSONResponse(Error{Code: "not_implemented", Message: "payments are not available yet"}), nil
}

func (s *Server) HandleStripeWebhook(_ context.Context, _ HandleStripeWebhookRequestObject) (HandleStripeWebhookResponseObject, error) {
	return HandleStripeWebhook501JSONResponse(Error{Code: "not_implemented", Message: "payments are not available yet"}), nil
}
