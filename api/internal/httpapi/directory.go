package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/directory"
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
	rows, err := directory.ListProviders(ctx, s.pool, f)
	if err != nil {
		return nil, err
	}
	out := ProviderList{Items: make([]Provider, 0, len(rows))}
	for _, r := range rows {
		modes := make([]ProviderVisitModes, len(r.VisitModes))
		for i, m := range r.VisitModes {
			modes[i] = ProviderVisitModes(m)
		}
		out.Items = append(out.Items, Provider{
			Id: r.ID, Name: r.Name, Type: ProviderType(r.Type), City: r.City, State: UsState(r.State),
			Languages: r.Languages, PriceUsd: int(r.PriceUsd), Summary: r.Summary,
			Credentials: r.Credentials, Bio: r.Bio, VisitModes: modes, SessionMinutes: int(r.SessionMinutes),
		})
	}
	return ListProviders200JSONResponse(out), nil
}

func (s *Server) ListProviderSlots(ctx context.Context, req ListProviderSlotsRequestObject) (ListProviderSlotsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListProviderSlots401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListProviderSlots404JSONResponse(errNoMember), nil
	}
	rows, err := directory.ListOpenSlots(ctx, s.pool, familyID, req.MemberId, req.Params.ProviderId, s.now(ctx), s.today(ctx))
	if err != nil {
		return nil, err
	}
	out := ProviderSlotList{Items: make([]ProviderSlot, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, ProviderSlot{Id: r.ID, ProviderId: r.ProviderID, StartsAt: r.StartsAt.UTC(), DurationMinutes: int(r.DurationMinutes)})
	}
	return ListProviderSlots200JSONResponse(out), nil
}

func (s *Server) CreateProviderBooking(ctx context.Context, req CreateProviderBookingRequestObject) (CreateProviderBookingResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateProviderBooking401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateProviderBooking404JSONResponse(errNoMember), nil
	}
	b, err := directory.Book(ctx, s.pool, familyID, req.MemberId, directory.NewBooking{
		SlotID: req.Body.SlotId, Visibility: string(req.Body.Visibility), Note: req.Body.Note,
	}, s.now(ctx))
	switch {
	case errors.Is(err, directory.ErrSlotTaken):
		return CreateProviderBooking409JSONResponse(errSlotTaken), nil
	case err != nil:
		return nil, err
	}
	return CreateProviderBooking201JSONResponse(providerBookingOut(b)), nil
}

func (s *Server) ListProviderBookings(ctx context.Context, req ListProviderBookingsRequestObject) (ListProviderBookingsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListProviderBookings401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListProviderBookings404JSONResponse(errNoMember), nil
	}
	rows, err := directory.ListBookings(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := ProviderBookingList{Items: make([]ProviderBooking, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, providerBookingOut(r))
	}
	return ListProviderBookings200JSONResponse(out), nil
}

func (s *Server) UpdateProviderBooking(ctx context.Context, req UpdateProviderBookingRequestObject) (UpdateProviderBookingResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateProviderBooking401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateProviderBooking404JSONResponse(errNoMember), nil
	}
	in := directory.Update{SlotID: req.Body.SlotId, Note: req.Body.Note}
	if req.Body.Visibility != nil {
		v := string(*req.Body.Visibility)
		in.Visibility = &v
	}
	b, err := directory.UpdateBooking(ctx, s.pool, familyID, req.MemberId, req.BookingId, in, s.now(ctx))
	switch {
	case errors.Is(err, directory.ErrNoBooking):
		return UpdateProviderBooking404JSONResponse(errNoProviderBooking), nil
	case errors.Is(err, directory.ErrStarted):
		return UpdateProviderBooking409JSONResponse(errBookingStarted), nil
	case errors.Is(err, directory.ErrSlotTaken):
		return UpdateProviderBooking409JSONResponse(errSlotTaken), nil
	case err != nil:
		return nil, err
	}
	return UpdateProviderBooking200JSONResponse(providerBookingOut(b)), nil
}

func (s *Server) DeleteProviderBooking(ctx context.Context, req DeleteProviderBookingRequestObject) (DeleteProviderBookingResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteProviderBooking401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteProviderBooking404JSONResponse(errNoMember), nil
	}
	switch err := directory.Cancel(ctx, s.pool, familyID, req.MemberId, req.BookingId); {
	case errors.Is(err, directory.ErrNoBooking):
		return DeleteProviderBooking404JSONResponse(errNoProviderBooking), nil
	case err != nil:
		return nil, err
	}
	return DeleteProviderBooking204Response{}, nil
}

// providerBookingOut reports a shared or private booking as the contract's two
// values; rows are only ever stored with one of them.
func providerBookingOut(b directory.Booking) ProviderBooking {
	vis := BookingVisibilityPrivate
	if b.Visibility != "private" {
		vis = BookingVisibilityFamily
	}
	return ProviderBooking{
		Id: b.ID, MemberId: b.OwnerMemberID, ProviderId: b.ProviderID, ProviderName: b.ProviderName,
		StartsAt: b.StartsAt.UTC(), DurationMinutes: int(b.DurationMinutes), Visibility: vis, Note: b.Note,
		CreatedAt: b.CreatedAt.UTC(),
	}
}
