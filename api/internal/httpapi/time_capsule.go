package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/capsule"
)

// Letters are parents only (actingMember answers 404 for a caregiver). The
// partner is listed the envelope; the text comes back only when the author shared it.

var (
	errNoLetter   = Error{Code: "not_found", Message: "no such letter"}
	errBadLetter  = Error{Code: "invalid_request", Message: "the letter needs an occasion and some text"}
	errLetterDate = Error{Code: "date_in_past", Message: "the opening date must be in the future"}
)

func letterOut(l capsule.Letter) Letter {
	out := Letter{
		Id: l.ID, AuthorId: l.OwnerID, ChildId: l.ChildID, Occasion: l.Occasion, OpensOn: apiDate(l.OpensOn),
		Visibility: LetterVisibility(l.Visibility), Body: l.Body, CreatedAt: l.CreatedAt.UTC(), UpdatedAt: l.UpdatedAt.UTC(),
	}
	return out
}

func letterInput(in LetterInput) capsule.Input {
	return capsule.Input{Occasion: in.Occasion, OpensOn: in.OpensOn.Time, Body: in.Body, Visibility: access.Visibility(in.Visibility), ChildID: in.ChildId}
}

func (s *Server) ListLetters(ctx context.Context, req ListLettersRequestObject) (ListLettersResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListLetters401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListLetters404JSONResponse(errNoMember), nil
	}
	rows, err := capsule.List(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	out := LetterList{Items: make([]Letter, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, letterOut(r))
	}
	return ListLetters200JSONResponse(out), nil
}

func (s *Server) CreateLetter(ctx context.Context, req CreateLetterRequestObject) (CreateLetterResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateLetter401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateLetter404JSONResponse(errNoMember), nil
	}
	l, err := capsule.Create(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, letterInput(*req.Body), s.today(ctx), s.now(ctx))
	switch {
	case errors.Is(err, capsule.ErrBadInput):
		return CreateLetter400JSONResponse(errBadLetter), nil
	case errors.Is(err, capsule.ErrDateInPast):
		return CreateLetter400JSONResponse(errLetterDate), nil
	case err != nil:
		return nil, err
	}
	return CreateLetter201JSONResponse(letterOut(l)), nil
}

func (s *Server) UpdateLetter(ctx context.Context, req UpdateLetterRequestObject) (UpdateLetterResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateLetter401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateLetter404JSONResponse(errNoMember), nil
	}
	l, err := capsule.Update(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, req.LetterId, letterInput(*req.Body), s.today(ctx), s.now(ctx))
	switch {
	case errors.Is(err, capsule.ErrNoLetter):
		return UpdateLetter404JSONResponse(errNoLetter), nil
	case errors.Is(err, capsule.ErrBadInput):
		return UpdateLetter400JSONResponse(errBadLetter), nil
	case errors.Is(err, capsule.ErrDateInPast):
		return UpdateLetter400JSONResponse(errLetterDate), nil
	case err != nil:
		return nil, err
	}
	return UpdateLetter200JSONResponse(letterOut(l)), nil
}

func (s *Server) DeleteLetter(ctx context.Context, req DeleteLetterRequestObject) (DeleteLetterResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteLetter401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteLetter404JSONResponse(errNoMember), nil
	}
	err = capsule.Delete(ctx, s.pool, familyID, req.MemberId, req.LetterId)
	switch {
	case errors.Is(err, capsule.ErrNoLetter):
		return DeleteLetter404JSONResponse(errNoLetter), nil
	case err != nil:
		return nil, err
	}
	return DeleteLetter204Response{}, nil
}
