package httpapi

import "context"

// ListMoodPatterns is a stub (#173): the frontend is built against the
// contract and shows an empty state while this returns 501. Replace with the
// real handler and remove the 501 response from openapi.yaml.
func (s *Server) ListMoodPatterns(ctx context.Context, req ListMoodPatternsRequestObject) (ListMoodPatternsResponseObject, error) {
	return ListMoodPatterns501JSONResponse(Error{Code: "not_implemented", Message: "mood patterns are not available yet"}), nil
}
