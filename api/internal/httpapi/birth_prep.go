package httpapi

import "context"

// STUB for the birth prep issue: the contract is in openapi.yaml, the
// implementation is not written yet. Replace each stub with a real handler
// (copy wellbeing.go), remove its 501 from openapi.yaml and replace its test.
// The web shows preview mocks on 501.

func (s *Server) GetBirthPlan(_ context.Context, _ GetBirthPlanRequestObject) (GetBirthPlanResponseObject, error) {
	return GetBirthPlan501JSONResponse(Error{Code: "not_implemented", Message: "the birth plan is not available yet"}), nil
}

func (s *Server) CreateLabourAlert(_ context.Context, _ CreateLabourAlertRequestObject) (CreateLabourAlertResponseObject, error) {
	return CreateLabourAlert501JSONResponse(Error{Code: "not_implemented", Message: "labour alerts are not available yet"}), nil
}

func (s *Server) GetAppointmentPrep(_ context.Context, _ GetAppointmentPrepRequestObject) (GetAppointmentPrepResponseObject, error) {
	return GetAppointmentPrep501JSONResponse(Error{Code: "not_implemented", Message: "appointment prep is not available yet"}), nil
}
