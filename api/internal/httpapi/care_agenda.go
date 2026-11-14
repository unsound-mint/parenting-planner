package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/care"
)

var errUnknownTopic = Error{Code: "unknown_topic", Message: "that topic is not on your agenda"}

// UpdatePsychologistAgenda stores the acting parent's own arrangement of their
// agenda. The id of the other parent's topic is just as unknown as a made-up one,
// so the answer reveals nothing.
func (s *Server) UpdatePsychologistAgenda(ctx context.Context, req UpdatePsychologistAgendaRequestObject) (UpdatePsychologistAgendaResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdatePsychologistAgenda401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdatePsychologistAgenda404JSONResponse(errNoMember), nil
	}
	a, err := care.UpdateAgenda(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, req.Body.TopicIds, s.now(ctx))
	if errors.Is(err, care.ErrUnknownTopic) {
		return UpdatePsychologistAgenda400JSONResponse(errUnknownTopic), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdatePsychologistAgenda200JSONResponse(agendaOut(a)), nil
}
