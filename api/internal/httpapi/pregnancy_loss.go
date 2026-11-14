package httpapi

import "context"

// STUB for #276: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) CreatePregnancyLoss(_ context.Context, _ CreatePregnancyLossRequestObject) (CreatePregnancyLossResponseObject, error) {
	return CreatePregnancyLoss501JSONResponse(Error{Code: "not_implemented", Message: "pregnancy loss support is not available yet"}), nil
}

func (s *Server) DeletePregnancyLoss(_ context.Context, _ DeletePregnancyLossRequestObject) (DeletePregnancyLossResponseObject, error) {
	return DeletePregnancyLoss501JSONResponse(Error{Code: "not_implemented", Message: "pregnancy loss support is not available yet"}), nil
}
