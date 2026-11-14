package httpapi

import "context"

// STUB for #232 and #235: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) CreateShift(_ context.Context, _ CreateShiftRequestObject) (CreateShiftResponseObject, error) {
	return CreateShift501JSONResponse(Error{Code: "not_implemented", Message: "shifts are not available yet"}), nil
}

func (s *Server) ListShifts(_ context.Context, _ ListShiftsRequestObject) (ListShiftsResponseObject, error) {
	return ListShifts501JSONResponse(Error{Code: "not_implemented", Message: "shifts are not available yet"}), nil
}
