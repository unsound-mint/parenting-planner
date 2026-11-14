package httpapi

// Handlers for the session brief and for moving or cancelling a session.

import (
	"context"
	"errors"
	"strings"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/unsound-mint/parenting-planner/api/internal/care"
)

var (
	errBriefSent    = Error{Code: "brief_sent", Message: "this brief has already been sent"}
	errNoUpcoming   = Error{Code: "no_session", Message: "book a session first"}
	errUnknownEntry = Error{Code: "unknown_entry", Message: "that entry is not on your agenda"}
)

func (s *Server) GetSessionBrief(ctx context.Context, req GetSessionBriefRequestObject) (GetSessionBriefResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetSessionBrief401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetSessionBrief404JSONResponse(errNoMember), nil
	}
	b, err := care.GetBrief(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	return GetSessionBrief200JSONResponse(briefOut(b)), nil
}

func (s *Server) UpdateSessionBrief(ctx context.Context, req UpdateSessionBriefRequestObject) (UpdateSessionBriefResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateSessionBrief401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateSessionBrief404JSONResponse(errNoMember), nil
	}
	in := care.BriefInput{Status: string(req.Body.Status), IncludeMood: req.Body.IncludeMood, EntryIDs: req.Body.SharedEntryIds}
	if req.Body.Note != nil {
		in.Note = strings.TrimSpace(*req.Body.Note)
	}
	b, err := care.SaveBrief(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, in, s.now(ctx))
	switch {
	case errors.Is(err, care.ErrBriefSent):
		return UpdateSessionBrief409JSONResponse(errBriefSent), nil
	case errors.Is(err, care.ErrNoSession):
		return UpdateSessionBrief409JSONResponse(errNoUpcoming), nil
	case errors.Is(err, care.ErrUnknownEntry):
		return UpdateSessionBrief400JSONResponse(errUnknownEntry), nil
	case err != nil:
		return nil, err
	}
	return UpdateSessionBrief200JSONResponse(briefOut(b)), nil
}

func (s *Server) UpdatePsychologistBooking(ctx context.Context, req UpdatePsychologistBookingRequestObject) (UpdatePsychologistBookingResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdatePsychologistBooking401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdatePsychologistBooking404JSONResponse(errNoMember), nil
	}
	b, err := care.MoveBooking(ctx, s.pool, familyID, req.MemberId, req.BookingId, req.Body.SlotId, s.now(ctx))
	switch {
	case errors.Is(err, care.ErrNoBooking):
		return UpdatePsychologistBooking404JSONResponse(errNoBooking), nil
	case errors.Is(err, care.ErrSlotTaken):
		return UpdatePsychologistBooking409JSONResponse(errSlotTaken), nil
	case err != nil:
		return nil, err
	}
	return UpdatePsychologistBooking200JSONResponse(bookingOut(b)), nil
}

func (s *Server) DeletePsychologistBooking(ctx context.Context, req DeletePsychologistBookingRequestObject) (DeletePsychologistBookingResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeletePsychologistBooking401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeletePsychologistBooking404JSONResponse(errNoMember), nil
	}
	err = care.CancelBooking(ctx, s.pool, familyID, req.MemberId, req.BookingId, s.now(ctx))
	switch {
	case errors.Is(err, care.ErrNoBooking):
		return DeletePsychologistBooking404JSONResponse(errNoBooking), nil
	case err != nil:
		return nil, err
	}
	return DeletePsychologistBooking204Response{}, nil
}

func briefOut(b care.Brief) SessionBrief {
	out := SessionBrief{
		Status: SessionBriefStatus(b.Status), IncludeMood: b.IncludeMood, SharedEntryIds: b.EntryIDs,
		Items: make([]SessionBriefItem, 0, len(b.Items)), UpdatedAt: b.UpdatedAt,
	}
	if b.Session != nil {
		bo := bookingOut(*b.Session)
		out.Session = &bo
	}
	if b.SendAt != nil {
		t := b.SendAt.UTC()
		out.SendAt = &t
	}
	if b.SentAt != nil {
		t := b.SentAt.UTC()
		out.SentAt = &t
	}
	if b.Note != "" {
		n := b.Note
		out.Note = &n
	}
	for _, it := range b.Items {
		o := SessionBriefItem{Text: it.Text}
		if it.DiaryEntryID.Valid {
			id := it.DiaryEntryID.UUID
			o.DiaryEntryId = &id
		}
		if it.WrittenAt != nil {
			t := it.WrittenAt.UTC()
			o.WrittenAt = &t
		}
		if it.EntryText != "" {
			t := it.EntryText
			o.EntryText = &t
		}
		out.Items = append(out.Items, o)
	}
	if m := b.Mood; m != nil {
		ms := MoodSummary{
			From: openapi_types.Date{Time: m.From}, To: openapi_types.Date{Time: m.To},
			Checkins: m.Checkins, LowDays: m.LowDays, Days: make([]MoodDay, 0, len(m.Days)),
		}
		if m.AverageSleep != nil {
			v := float32(*m.AverageSleep)
			ms.AverageSleep = &v
		}
		for _, d := range m.Days {
			ms.Days = append(ms.Days, MoodDay{Day: openapi_types.Date{Time: d.Day}, Mood: float32(d.Mood)})
		}
		out.Mood = &ms
	}
	return out
}
