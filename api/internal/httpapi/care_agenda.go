package httpapi

import "context"

// STUB for the agenda order backend issue: the contract is in openapi.yaml,
// the implementation is not written yet. Replace it with a real handler
// (copy GetPsychologistAgenda in care.go), remove its 501 from openapi.yaml
// and replace its test. The web keeps the order locally on 501.

func (s *Server) UpdatePsychologistAgenda(_ context.Context, _ UpdatePsychologistAgendaRequestObject) (UpdatePsychologistAgendaResponseObject, error) {
	return UpdatePsychologistAgenda501JSONResponse(Error{Code: "not_implemented", Message: "saving the agenda is not available yet"}), nil
}
