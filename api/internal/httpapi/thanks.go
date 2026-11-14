package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/thanks"
)

var (
	errThanksToSelf    = Error{Code: "to_self", Message: "a thank-you note goes to someone else"}
	errThanksTarget    = Error{Code: "bad_recipient", Message: "the note goes to the other parent or a caregiver of the family"}
	errThanksDuplicate = Error{Code: "already_thanked", Message: "this has been thanked already"}
	errThanksEmpty     = Error{Code: "invalid_request", Message: "a thank-you note needs some words"}
)

func thanksOut(t store.Thank) Thanks {
	return Thanks{Id: t.ID, FromMemberId: t.FromMemberID, ToMemberId: t.ToMemberID, Body: t.Body, SuggestionKey: t.SuggestionKey, CreatedAt: t.CreatedAt}
}

func (s *Server) ListThanks(ctx context.Context, req ListThanksRequestObject) (ListThanksResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListThanks401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListThanks404JSONResponse(errNoMember), nil
	}
	rows, err := thanks.List(ctx, s.pool, familyID, m, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := ThanksList{Items: make([]Thanks, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, thanksOut(r))
	}
	return ListThanks200JSONResponse(out), nil
}

func (s *Server) CreateThanks(ctx context.Context, req CreateThanksRequestObject) (CreateThanksResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateThanks401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateThanks404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return CreateThanks403JSONResponse(errForbidden), nil
	}
	b := req.Body
	t, err := thanks.Send(ctx, s.pool, familyID, m, b.ToMemberId, b.Body, b.SuggestionKey, s.now(ctx))
	switch {
	case errors.Is(err, thanks.ErrToSelf):
		return CreateThanks409JSONResponse(errThanksToSelf), nil
	case errors.Is(err, thanks.ErrDuplicate):
		return CreateThanks409JSONResponse(errThanksDuplicate), nil
	case errors.Is(err, thanks.ErrNoTarget):
		return CreateThanks400JSONResponse(errThanksTarget), nil
	case errors.Is(err, thanks.ErrEmpty):
		return CreateThanks400JSONResponse(errThanksEmpty), nil
	case err != nil:
		return nil, err
	}
	return CreateThanks201JSONResponse(thanksOut(t)), nil
}

func (s *Server) ListThanksSuggestions(ctx context.Context, req ListThanksSuggestionsRequestObject) (ListThanksSuggestionsResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListThanksSuggestions401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListThanksSuggestions404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return ListThanksSuggestions403JSONResponse(errForbidden), nil
	}
	sug, err := thanks.Suggestions(ctx, s.pool, familyID, m, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := ThanksSuggestionList{Items: make([]ThanksSuggestion, 0, len(sug))}
	for _, x := range sug {
		count := x.Count
		on := openapi_types.Date{Time: x.On}
		out.Items = append(out.Items, ThanksSuggestion{Key: x.Key, ToMemberId: x.ToMember, Basis: ThanksBasis(x.Basis), Count: &count, On: &on, Text: x.Text})
	}
	return ListThanksSuggestions200JSONResponse(out), nil
}
