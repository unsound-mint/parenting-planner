package httpapi

import "context"

// STUB for #224, #247 and #250 (Sofia's PR #258 implements the reassignment flow): the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) CreateTask(_ context.Context, _ CreateTaskRequestObject) (CreateTaskResponseObject, error) {
	return CreateTask501JSONResponse(Error{Code: "not_implemented", Message: "tasks are not available yet"}), nil
}

func (s *Server) ListTasks(_ context.Context, _ ListTasksRequestObject) (ListTasksResponseObject, error) {
	return ListTasks501JSONResponse(Error{Code: "not_implemented", Message: "tasks are not available yet"}), nil
}

func (s *Server) UpdateTask(_ context.Context, _ UpdateTaskRequestObject) (UpdateTaskResponseObject, error) {
	return UpdateTask501JSONResponse(Error{Code: "not_implemented", Message: "tasks are not available yet"}), nil
}

func (s *Server) ProposeTaskReassignment(_ context.Context, _ ProposeTaskReassignmentRequestObject) (ProposeTaskReassignmentResponseObject, error) {
	return ProposeTaskReassignment501JSONResponse(Error{Code: "not_implemented", Message: "tasks are not available yet"}), nil
}

func (s *Server) AcceptTaskReassignment(_ context.Context, _ AcceptTaskReassignmentRequestObject) (AcceptTaskReassignmentResponseObject, error) {
	return AcceptTaskReassignment501JSONResponse(Error{Code: "not_implemented", Message: "tasks are not available yet"}), nil
}

func (s *Server) DeclineTaskReassignment(_ context.Context, _ DeclineTaskReassignmentRequestObject) (DeclineTaskReassignmentResponseObject, error) {
	return DeclineTaskReassignment501JSONResponse(Error{Code: "not_implemented", Message: "tasks are not available yet"}), nil
}
