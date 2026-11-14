package httpapi

import "context"

// STUB for #273: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) ListScreeningQuestionnaires(_ context.Context, _ ListScreeningQuestionnairesRequestObject) (ListScreeningQuestionnairesResponseObject, error) {
	return ListScreeningQuestionnaires501JSONResponse(Error{Code: "not_implemented", Message: "mood questionnaires are not available yet"}), nil
}

func (s *Server) CreateMoodScreening(_ context.Context, _ CreateMoodScreeningRequestObject) (CreateMoodScreeningResponseObject, error) {
	return CreateMoodScreening501JSONResponse(Error{Code: "not_implemented", Message: "mood questionnaires are not available yet"}), nil
}

func (s *Server) ListMoodScreenings(_ context.Context, _ ListMoodScreeningsRequestObject) (ListMoodScreeningsResponseObject, error) {
	return ListMoodScreenings501JSONResponse(Error{Code: "not_implemented", Message: "mood questionnaires are not available yet"}), nil
}
