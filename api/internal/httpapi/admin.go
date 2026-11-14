package httpapi

import "context"

// STUB for #285 (content): the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) ListContentItems(_ context.Context, _ ListContentItemsRequestObject) (ListContentItemsResponseObject, error) {
	return ListContentItems501JSONResponse(Error{Code: "not_implemented", Message: "the content admin is not available yet"}), nil
}

func (s *Server) UpdateContentItem(_ context.Context, _ UpdateContentItemRequestObject) (UpdateContentItemResponseObject, error) {
	return UpdateContentItem501JSONResponse(Error{Code: "not_implemented", Message: "the content admin is not available yet"}), nil
}

func (s *Server) ResetContentItem(_ context.Context, _ ResetContentItemRequestObject) (ResetContentItemResponseObject, error) {
	return ResetContentItem501JSONResponse(Error{Code: "not_implemented", Message: "the content admin is not available yet"}), nil
}
