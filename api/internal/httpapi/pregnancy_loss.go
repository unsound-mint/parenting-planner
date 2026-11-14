package httpapi

import (
	"context"
	"errors"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/family"
)

var (
	errLossDateInFuture = Error{Code: "invalid_request", Message: "the date cannot be in the future"}
	errNoPregnancyLoss  = Error{Code: "no_pregnancy_loss", Message: "pregnancy loss support is not on"}
)

// CreatePregnancyLoss turns support on: the stage becomes planning and the due
// date is cleared, so the weekly card, the pregnancy rules and the gestational
// week stop on their own. The replaced stage and due date are kept for an undo.
func (s *Server) CreatePregnancyLoss(ctx context.Context, req CreatePregnancyLossRequestObject) (CreatePregnancyLossResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreatePregnancyLoss401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreatePregnancyLoss404JSONResponse(errNoMember), nil
	}
	var occurred *time.Time
	if req.Body != nil && req.Body.OccurredOn != nil {
		occurred = &req.Body.OccurredOn.Time
	}
	_, err = family.RecordLoss(ctx, s.pool, familyID, req.MemberId, occurred, s.today(ctx), s.now(ctx))
	switch {
	case errors.Is(err, family.ErrLossNotPregnant):
		return CreatePregnancyLoss409JSONResponse(errNotPregnant), nil
	case errors.Is(err, family.ErrLossDateInFuture):
		return CreatePregnancyLoss400JSONResponse(errLossDateInFuture), nil
	case err != nil:
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return CreatePregnancyLoss201JSONResponse(fam), nil
}

// DeletePregnancyLoss turns support off and restores the stage and due date it replaced.
func (s *Server) DeletePregnancyLoss(ctx context.Context, req DeletePregnancyLossRequestObject) (DeletePregnancyLossResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeletePregnancyLoss401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeletePregnancyLoss404JSONResponse(errNoMember), nil
	}
	if _, err := family.UndoLoss(ctx, s.pool, familyID, req.MemberId); err != nil {
		if errors.Is(err, family.ErrNoLoss) {
			return DeletePregnancyLoss409JSONResponse(errNoPregnancyLoss), nil
		}
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return DeletePregnancyLoss200JSONResponse(fam), nil
}
