package httpapi

import "context"

// STUB: the contract for the "Tonight, together" card, couple talks and the
// shared baby name list is in openapi.yaml; the implementation follows in its
// own PR. Replace each stub with a real handler, remove its 501 from
// openapi.yaml and its stub test.

var errTogetherNotImplemented = Error{Code: "not_implemented", Message: "the couple card is not available yet"}

func (s *Server) GetTogether(_ context.Context, _ GetTogetherRequestObject) (GetTogetherResponseObject, error) {
	return GetTogether501JSONResponse(errTogetherNotImplemented), nil
}

func (s *Server) CreateCoupleTalk(_ context.Context, _ CreateCoupleTalkRequestObject) (CreateCoupleTalkResponseObject, error) {
	return CreateCoupleTalk501JSONResponse(errTogetherNotImplemented), nil
}

func (s *Server) ListBabyNames(_ context.Context, _ ListBabyNamesRequestObject) (ListBabyNamesResponseObject, error) {
	return ListBabyNames501JSONResponse(errTogetherNotImplemented), nil
}

func (s *Server) CreateBabyName(_ context.Context, _ CreateBabyNameRequestObject) (CreateBabyNameResponseObject, error) {
	return CreateBabyName501JSONResponse(errTogetherNotImplemented), nil
}

func (s *Server) LikeBabyName(_ context.Context, _ LikeBabyNameRequestObject) (LikeBabyNameResponseObject, error) {
	return LikeBabyName501JSONResponse(errTogetherNotImplemented), nil
}

func (s *Server) UnlikeBabyName(_ context.Context, _ UnlikeBabyNameRequestObject) (UnlikeBabyNameResponseObject, error) {
	return UnlikeBabyName501JSONResponse(errTogetherNotImplemented), nil
}
