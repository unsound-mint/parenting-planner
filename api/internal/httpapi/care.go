package httpapi

// STUBS: the care endpoints (psychologist flow, #174) are in the contract so
// the web screen can be built. Every one returns 501 until the real handlers
// land. Replace each method body following internal/httpapi/wellbeing.go and
// remove the 501 responses from openapi.yaml when the last one is done.

import "context"

var errNotBuilt = Error{Code: "not_implemented", Message: "this part is not available yet"}

func (s *Server) GetPsychologistAgenda(context.Context, GetPsychologistAgendaRequestObject) (GetPsychologistAgendaResponseObject, error) {
	return GetPsychologistAgenda501JSONResponse(errNotBuilt), nil
}

func (s *Server) ListPsychologistSlots(context.Context, ListPsychologistSlotsRequestObject) (ListPsychologistSlotsResponseObject, error) {
	return ListPsychologistSlots501JSONResponse(errNotBuilt), nil
}

func (s *Server) CreatePsychologistBooking(context.Context, CreatePsychologistBookingRequestObject) (CreatePsychologistBookingResponseObject, error) {
	return CreatePsychologistBooking501JSONResponse(errNotBuilt), nil
}

func (s *Server) CreateSessionNote(context.Context, CreateSessionNoteRequestObject) (CreateSessionNoteResponseObject, error) {
	return CreateSessionNote501JSONResponse(errNotBuilt), nil
}
