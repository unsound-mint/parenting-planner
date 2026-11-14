// Package directory owns the provider directory, its open times and bookings.
//
// Providers are global synthetic demo data, the same for every family, so
// reading them is not audited. Open times (provider_slots) are synthetic too
// but stored per family, so one demo session never takes another's times; they
// are filled lazily a few weeks ahead (EnsureSlots).
//
// Bookings are sensitive (they can reveal that a parent is seeking care): they
// follow the wellbeing pattern, run in a transaction with access.Audit, and are
// read through the ...VisibleToParent queries. The parent picks private or
// family; only the owner moves, edits or cancels one.
package directory

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityBooking = "provider_booking"

const (
	// SlotWindow is how far ahead open times are listed.
	SlotWindow = 14 * 24 * time.Hour
	// fillDays is how far ahead one fill reaches; it runs again once fewer
	// than SlotWindow days are filled.
	fillDays = 28
	// BookingHistory is how far back ListBookings reaches.
	BookingHistory = 30 * 24 * time.Hour
)

var (
	// ErrSlotTaken means the time is unknown, past, or no longer open to this parent.
	ErrSlotTaken = errors.New("slot taken")
	// ErrNoBooking means the booking is not this parent's.
	ErrNoBooking = errors.New("no such booking")
	// ErrStarted means the booking has started and cannot move.
	ErrStarted = errors.New("booking started")
)

// Booking is one booking with its time and provider.
type Booking = store.ListProviderBookingsVisibleToParentRow

// Filter narrows ListProviders; nil fields mean no filter.
type Filter struct {
	Type  *string
	State *string
}

// ListProviders returns the directory sorted by name.
func ListProviders(ctx context.Context, pool *pgxpool.Pool, f Filter) ([]store.ListProvidersRow, error) {
	return store.New(pool).ListProviders(ctx, store.ListProvidersParams{Type: f.Type, State: f.State})
}

// EnsureSlots fills the family's open times through today + fillDays when
// fewer than SlotWindow days are left. Idempotent: the fill skips times that
// exist, so two requests racing only do the work twice.
func EnsureSlots(ctx context.Context, q *store.Queries, familyID uuid.UUID, today time.Time) error {
	through, err := q.GetProviderSlotsThrough(ctx, familyID)
	if err != nil {
		return err
	}
	if through != nil && !through.Before(today.Add(SlotWindow)) {
		return nil
	}
	from := today
	if through != nil && through.After(today) {
		from = through.AddDate(0, 0, 1)
	}
	to := today.AddDate(0, 0, fillDays)
	if err := q.FillProviderSlots(ctx, store.FillProviderSlotsParams{FamilyID: familyID, FromDay: from, ToDay: to}); err != nil {
		return err
	}
	return q.SetProviderSlotsThrough(ctx, store.SetProviderSlotsThroughParams{FamilyID: familyID, Through: to})
}

// ListOpenSlots returns the open times in the next SlotWindow for the viewer,
// soonest first, optionally for one provider.
func ListOpenSlots(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, provider *uuid.UUID, now, today time.Time) ([]store.ListOpenProviderSlotsVisibleToParentRow, error) {
	var out []store.ListOpenProviderSlotsVisibleToParentRow
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := EnsureSlots(ctx, q, familyID, today); err != nil {
			return err
		}
		p := uuid.NullUUID{}
		if provider != nil {
			p = uuid.NullUUID{UUID: *provider, Valid: true}
		}
		rows, err := q.ListOpenProviderSlotsVisibleToParent(ctx, store.ListOpenProviderSlotsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, FromTime: now, ToTime: now.Add(SlotWindow), ProviderID: p,
		})
		out = rows
		return err
	})
	return out, err
}

type NewBooking struct {
	SlotID     uuid.UUID
	Visibility string
	Note       *string
}

// Book books an open future time for the acting parent.
func Book(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewBooking, now time.Time) (Booking, error) {
	var out Booking
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		id, err := q.CreateProviderBookingVisibleToParent(ctx, store.CreateProviderBookingVisibleToParentParams{
			FamilyID: familyID, OwnerMemberID: actor, SlotID: in.SlotID, Visibility: in.Visibility, Note: emptyToNil(in.Note), Now: now,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSlotTaken
		}
		if err != nil {
			return err
		}
		if out, err = get(ctx, q, familyID, actor, id); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityBooking, id.String())
	})
	return out, err
}

// Update is a partial change: nil fields stay as they are.
type Update struct {
	SlotID     *uuid.UUID
	Visibility *string
	Note       *string
}

// UpdateBooking moves a booking to another open time with the same provider,
// or changes who sees it or its note. Owner only.
func UpdateBooking(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID, in Update, now time.Time) (Booking, error) {
	var out Booking
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		b, err := q.GetOwnProviderBookingVisibleToParent(ctx, store.GetOwnProviderBookingVisibleToParentParams{ID: id, FamilyID: familyID, OwnerMemberID: actor})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoBooking
		}
		if err != nil {
			return err
		}
		if in.SlotID != nil {
			if !b.StartsAt.After(now) {
				return ErrStarted
			}
			_, err := q.MoveProviderBookingVisibleToParent(ctx, store.MoveProviderBookingVisibleToParentParams{
				ID: id, FamilyID: familyID, OwnerMemberID: actor, SlotID: *in.SlotID, ProviderID: b.ProviderID, Now: now,
			})
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrSlotTaken
			}
			if err != nil {
				return err
			}
		}
		if in.Visibility != nil || in.Note != nil {
			vis, note := b.Visibility, b.Note
			if in.Visibility != nil {
				vis = *in.Visibility
			}
			if in.Note != nil {
				note = emptyToNil(in.Note)
			}
			if err := q.UpdateProviderBookingDetails(ctx, store.UpdateProviderBookingDetailsParams{
				ID: id, FamilyID: familyID, OwnerMemberID: actor, Visibility: vis, Note: note,
			}); err != nil {
				return err
			}
		}
		if out, err = get(ctx, q, familyID, actor, id); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityBooking, id.String())
	})
	return out, err
}

// Cancel deletes the owner's booking; its time is open again.
func Cancel(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.DeleteProviderBooking(ctx, store.DeleteProviderBookingParams{ID: id, FamilyID: familyID, OwnerMemberID: actor})
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNoBooking
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entityBooking, id.String())
	})
}

// ListBookings returns the bookings the viewer may see from BookingHistory ago
// on, soonest first.
func ListBookings(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]Booking, error) {
	var out []Booking
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := ListVisible(ctx, q, familyID, viewer, now.Add(-BookingHistory), now.AddDate(1, 0, 0))
		if err != nil {
			return err
		}
		out = rows
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityBooking, "")
	})
	return out, err
}

// ListVisible reads the bookings in [from, to) the viewer may see, for callers
// that already run a transaction and audit the read (the calendar).
func ListVisible(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, from, to time.Time) ([]Booking, error) {
	return q.ListProviderBookingsVisibleToParent(ctx, store.ListProviderBookingsVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer, FromTime: from, ToTime: to,
	})
}

func get(ctx context.Context, q *store.Queries, familyID, viewer, id uuid.UUID) (Booking, error) {
	r, err := q.GetProviderBookingVisibleToParent(ctx, store.GetProviderBookingVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: viewer})
	return Booking(r), err
}

func emptyToNil(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}
