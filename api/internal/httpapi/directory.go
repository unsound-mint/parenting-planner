package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/directory"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// ListProviders needs a session but no member: the directory is the same
// synthetic data for every family.
func (s *Server) ListProviders(ctx context.Context, req ListProvidersRequestObject) (ListProvidersResponseObject, error) {
	if _, ok := familyFrom(ctx); !ok {
		return ListProviders401JSONResponse(errNoSession), nil
	}
	var f directory.Filter
	if req.Params.Type != nil {
		t := string(*req.Params.Type)
		f.Type = &t
	}
	if req.Params.State != nil {
		st := string(*req.Params.State)
		f.State = &st
	}
	rows, err := directory.ListProviders(ctx, s.pool, s.today(ctx), f)
	if err != nil {
		return nil, err
	}
	out := ProviderList{Items: make([]Provider, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, Provider{
			Id: r.ID, Name: r.Name, Type: ProviderType(r.Type), City: r.City, State: UsState(r.State),
			Languages: r.Languages, NextAvailable: openapi_types.Date{Time: r.NextAvailable},
			PriceUsd: int(r.PriceUsd), Summary: r.Summary,
		})
	}
	return ListProviders200JSONResponse(out), nil
}

func (s *Server) CreateBookingRequest(ctx context.Context, req CreateBookingRequestRequestObject) (CreateBookingRequestResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateBookingRequest401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateBookingRequest404JSONResponse(errNoMember), nil
	}
	b, err := directory.CreateBookingRequest(ctx, s.pool, familyID, req.MemberId, directory.NewBookingRequest{
		ProviderID: req.Body.ProviderId, Note: req.Body.Note, CreatedAt: s.now(ctx),
	})
	switch {
	case errors.Is(err, directory.ErrUnknownProvider):
		return CreateBookingRequest400JSONResponse(errUnknownProvider), nil
	case errors.Is(err, directory.ErrAlreadyRequested):
		return CreateBookingRequest409JSONResponse(errAlreadyRequested), nil
	case err != nil:
		return nil, err
	}
	return CreateBookingRequest201JSONResponse(bookingRequestOut(b)), nil
}

func (s *Server) ListBookingRequests(ctx context.Context, req ListBookingRequestsRequestObject) (ListBookingRequestsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListBookingRequests401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListBookingRequests404JSONResponse(errNoMember), nil
	}
	rows, err := directory.ListBookingRequests(ctx, s.pool, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	out := BookingRequestList{Items: make([]BookingRequest, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, bookingRequestOut(r))
	}
	return ListBookingRequests200JSONResponse(out), nil
}

func bookingRequestOut(b store.BookingRequest) BookingRequest {
	return BookingRequest{
		Id: b.ID, MemberId: b.OwnerMemberID, ProviderId: b.ProviderID,
		Status: BookingRequestStatus(b.Status), Note: b.Note, CreatedAt: b.CreatedAt.UTC(),
	}
}
