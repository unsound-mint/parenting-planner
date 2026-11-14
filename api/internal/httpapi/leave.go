package httpapi

import "context"

// STUB for #264: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) GetLeavePlan(_ context.Context, _ GetLeavePlanRequestObject) (GetLeavePlanResponseObject, error) {
	return GetLeavePlan501JSONResponse(Error{Code: "not_implemented", Message: "the leave planner is not available yet"}), nil
}

func (s *Server) UpdateLeavePlan(_ context.Context, _ UpdateLeavePlanRequestObject) (UpdateLeavePlanResponseObject, error) {
	return UpdateLeavePlan501JSONResponse(Error{Code: "not_implemented", Message: "the leave planner is not available yet"}), nil
}
