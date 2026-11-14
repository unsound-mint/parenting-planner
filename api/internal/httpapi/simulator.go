package httpapi

import (
	"context"

	"github.com/google/uuid"
)

// STUB for #232: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.
//
// The rounds rehearse the first nights with a newborn, so they are offered
// only while the family is expecting: once the baby is home (or before a
// pregnancy, or in loss support) every simulator call answers 404, which also
// hides the preview mocks, the nav entry and the Practice section on Learn.

var errPracticeNotForStage = Error{Code: "not_found", Message: "practice rounds are for the months before the baby comes"}

// practiceStatus is 0 when the simulator applies to this person's family,
// otherwise the status and error to answer with (401, or 404 for another
// family's member or a stage without practice).
func (s *Server) practiceStatus(ctx context.Context, memberID uuid.UUID) (int, Error, error) {
	familyID, _, kind, err := s.actingMember(ctx, memberID)
	switch {
	case err != nil:
		return 0, Error{}, err
	case kind == errUnauthorized:
		return 401, errNoSession, nil
	case kind == errNotFound:
		return 404, errNoMember, nil
	}
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return 0, Error{}, err
	}
	// Loss support moves the family to planning, so it is covered too.
	if fam.Stage != "pregnancy" {
		return 404, errPracticeNotForStage, nil
	}
	return 0, Error{}, nil
}

func (s *Server) GetSimulatorProgress(ctx context.Context, req GetSimulatorProgressRequestObject) (GetSimulatorProgressResponseObject, error) {
	switch st, e, err := s.practiceStatus(ctx, req.MemberId); {
	case err != nil:
		return nil, err
	case st == 401:
		return GetSimulatorProgress401JSONResponse(e), nil
	case st == 404:
		return GetSimulatorProgress404JSONResponse(e), nil
	}
	return GetSimulatorProgress501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}

func (s *Server) CreateSimulatorRound(ctx context.Context, req CreateSimulatorRoundRequestObject) (CreateSimulatorRoundResponseObject, error) {
	switch st, e, err := s.practiceStatus(ctx, req.MemberId); {
	case err != nil:
		return nil, err
	case st == 401:
		return CreateSimulatorRound401JSONResponse(e), nil
	case st == 404:
		return CreateSimulatorRound404JSONResponse(e), nil
	}
	return CreateSimulatorRound501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}

func (s *Server) GetSimulatorRound(ctx context.Context, req GetSimulatorRoundRequestObject) (GetSimulatorRoundResponseObject, error) {
	switch st, e, err := s.practiceStatus(ctx, req.MemberId); {
	case err != nil:
		return nil, err
	case st == 401:
		return GetSimulatorRound401JSONResponse(e), nil
	case st == 404:
		return GetSimulatorRound404JSONResponse(e), nil
	}
	return GetSimulatorRound501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}

func (s *Server) CreateSimulatorAnswer(ctx context.Context, req CreateSimulatorAnswerRequestObject) (CreateSimulatorAnswerResponseObject, error) {
	switch st, e, err := s.practiceStatus(ctx, req.MemberId); {
	case err != nil:
		return nil, err
	case st == 401:
		return CreateSimulatorAnswer401JSONResponse(e), nil
	case st == 404:
		return CreateSimulatorAnswer404JSONResponse(e), nil
	}
	return CreateSimulatorAnswer501JSONResponse(Error{Code: "not_implemented", Message: "the simulator is not available yet"}), nil
}
