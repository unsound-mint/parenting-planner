package httpapi

import "context"

// STUB for the milestone checklist: the contract is in openapi.yaml, the
// implementation is not written yet. Replace each stub with a real handler
// (copy child_passport.go), remove its 501 from openapi.yaml and replace its test.

func (s *Server) ListChildMilestones(_ context.Context, _ ListChildMilestonesRequestObject) (ListChildMilestonesResponseObject, error) {
	return ListChildMilestones501JSONResponse(Error{Code: "not_implemented", Message: "milestones are not available yet"}), nil
}

func (s *Server) SetChildMilestone(_ context.Context, _ SetChildMilestoneRequestObject) (SetChildMilestoneResponseObject, error) {
	return SetChildMilestone501JSONResponse(Error{Code: "not_implemented", Message: "milestones are not available yet"}), nil
}
