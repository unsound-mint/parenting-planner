package httpapi

import "context"

// STUB for #229 and #253: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) ListCalendarEvents(_ context.Context, _ ListCalendarEventsRequestObject) (ListCalendarEventsResponseObject, error) {
	return ListCalendarEvents501JSONResponse(Error{Code: "not_implemented", Message: "the calendar is not available yet"}), nil
}

func (s *Server) CreateCalendarEvent(_ context.Context, _ CreateCalendarEventRequestObject) (CreateCalendarEventResponseObject, error) {
	return CreateCalendarEvent501JSONResponse(Error{Code: "not_implemented", Message: "the calendar is not available yet"}), nil
}

func (s *Server) UpdateCalendarEvent(_ context.Context, _ UpdateCalendarEventRequestObject) (UpdateCalendarEventResponseObject, error) {
	return UpdateCalendarEvent501JSONResponse(Error{Code: "not_implemented", Message: "the calendar is not available yet"}), nil
}

func (s *Server) CreateAppointmentQuestion(_ context.Context, _ CreateAppointmentQuestionRequestObject) (CreateAppointmentQuestionResponseObject, error) {
	return CreateAppointmentQuestion501JSONResponse(Error{Code: "not_implemented", Message: "appointment questions are not available yet"}), nil
}

func (s *Server) ListAppointmentQuestions(_ context.Context, _ ListAppointmentQuestionsRequestObject) (ListAppointmentQuestionsResponseObject, error) {
	return ListAppointmentQuestions501JSONResponse(Error{Code: "not_implemented", Message: "appointment questions are not available yet"}), nil
}

func (s *Server) UpdateAppointmentQuestion(_ context.Context, _ UpdateAppointmentQuestionRequestObject) (UpdateAppointmentQuestionResponseObject, error) {
	return UpdateAppointmentQuestion501JSONResponse(Error{Code: "not_implemented", Message: "appointment questions are not available yet"}), nil
}
