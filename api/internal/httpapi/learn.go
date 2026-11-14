package httpapi

import "context"

// STUB: the contract for learning paths, lesson reads and quiz answers is in
// openapi.yaml; the implementation follows in its own PR. Replace each stub
// with a real handler, remove its 501 from openapi.yaml and its stub test.

var errLearnNotImplemented = Error{Code: "not_implemented", Message: "learning paths are not available yet"}

func (s *Server) ListLearningPaths(_ context.Context, _ ListLearningPathsRequestObject) (ListLearningPathsResponseObject, error) {
	return ListLearningPaths501JSONResponse(errLearnNotImplemented), nil
}

func (s *Server) UpdateLessonRead(_ context.Context, _ UpdateLessonReadRequestObject) (UpdateLessonReadResponseObject, error) {
	return UpdateLessonRead501JSONResponse(errLearnNotImplemented), nil
}

func (s *Server) CreateQuizAnswer(_ context.Context, _ CreateQuizAnswerRequestObject) (CreateQuizAnswerResponseObject, error) {
	return CreateQuizAnswer501JSONResponse(errLearnNotImplemented), nil
}
