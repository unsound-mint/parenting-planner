package httpapi

// Handlers for the psychologist flow (#174). Shape copied from wellbeing.go.

import (
	"context"
	"errors"
	"strings"

	"github.com/unsound-mint/parenting-planner/api/internal/care"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func (s *Server) GetPsychologistAgenda(ctx context.Context, req GetPsychologistAgendaRequestObject) (GetPsychologistAgendaResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetPsychologistAgenda401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetPsychologistAgenda404JSONResponse(errNoMember), nil
	}
	a, err := care.GetAgenda(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := PsychologistAgenda{Topics: make([]AgendaTopic, 0, len(a.Topics))}
	for _, t := range a.Topics {
		out.Topics = append(out.Topics, AgendaTopic{Id: t.ID, Text: t.Text, AddedAt: t.AddedAt.UTC()})
	}
	if a.NextSession != nil {
		b := bookingOut(*a.NextSession)
		out.NextSession = &b
	}
	if a.NoteDue != nil {
		b := bookingOut(*a.NoteDue)
		out.NoteDue = &b
	}
	return GetPsychologistAgenda200JSONResponse(out), nil
}

func (s *Server) ListPsychologistSlots(ctx context.Context, req ListPsychologistSlotsRequestObject) (ListPsychologistSlotsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListPsychologistSlots401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListPsychologistSlots404JSONResponse(errNoMember), nil
	}
	p, slots, err := care.ListOpenSlots(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := PsychologistSlots{Provider: psychologistOut(p), Items: make([]Slot, 0, len(slots))}
	for _, sl := range slots {
		out.Items = append(out.Items, Slot{Id: sl.ID, StartsAt: sl.StartsAt.UTC(), DurationMinutes: int(sl.DurationMinutes)})
	}
	return ListPsychologistSlots200JSONResponse(out), nil
}

func (s *Server) CreatePsychologistBooking(ctx context.Context, req CreatePsychologistBookingRequestObject) (CreatePsychologistBookingResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreatePsychologistBooking401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreatePsychologistBooking404JSONResponse(errNoMember), nil
	}
	b, err := care.Book(ctx, s.pool, familyID, req.MemberId, req.Body.SlotId, s.now(ctx))
	switch {
	case errors.Is(err, care.ErrSlotTaken):
		return CreatePsychologistBooking409JSONResponse(errSlotTaken), nil
	case err != nil:
		return nil, err
	}
	return CreatePsychologistBooking201JSONResponse(bookingOut(b)), nil
}

func (s *Server) CreateSessionNote(ctx context.Context, req CreateSessionNoteRequestObject) (CreateSessionNoteResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateSessionNote401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateSessionNote404JSONResponse(errNoMember), nil
	}
	text := strings.TrimSpace(req.Body.Text)
	if text == "" {
		return CreateSessionNote400JSONResponse(errEmptyNote), nil
	}
	n, err := care.WriteNote(ctx, s.pool, familyID, req.MemberId, req.Body.BookingId, text, s.now(ctx))
	switch {
	case errors.Is(err, care.ErrNoBooking):
		return CreateSessionNote404JSONResponse(errNoBooking), nil
	case errors.Is(err, care.ErrNotStarted):
		return CreateSessionNote400JSONResponse(errSessionNotStarted), nil
	case errors.Is(err, care.ErrNoteExists):
		return CreateSessionNote400JSONResponse(errNoteExists), nil
	case err != nil:
		return nil, err
	}
	return CreateSessionNote201JSONResponse(SessionNote{Id: n.ID, BookingId: n.BookingID, WrittenAt: n.WrittenAt.UTC(), Text: n.Text}), nil
}

func psychologistOut(p store.Psychologist) Psychologist {
	return Psychologist{Id: p.ID, Name: p.Name, Credentials: p.Credentials, Focus: p.Focus}
}

func bookingOut(b care.Booking) PsychologistBooking {
	return PsychologistBooking{
		Id: b.ID, Provider: psychologistOut(b.Psychologist), StartsAt: b.StartsAt.UTC(),
		DurationMinutes: b.DurationMinutes, NoteWritten: b.NoteWritten,
	}
}
