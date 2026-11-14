package httpapi

import "context"

// STUB for #232: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) GetSimulatorProgress(_ context.Context, _ GetSimulatorProgressRequestObject) (GetSimulatorProgressResponseObject, error) {
	return GetSimulatorProgress501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}

func (s *Server) CreateSimulatorRound(_ context.Context, _ CreateSimulatorRoundRequestObject) (CreateSimulatorRoundResponseObject, error) {
	return CreateSimulatorRound501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}

func (s *Server) GetSimulatorRound(_ context.Context, _ GetSimulatorRoundRequestObject) (GetSimulatorRoundResponseObject, error) {
	return GetSimulatorRound501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}

func (s *Server) CreateSimulatorAnswer(_ context.Context, _ CreateSimulatorAnswerRequestObject) (CreateSimulatorAnswerResponseObject, error) {
	return CreateSimulatorAnswer501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}
