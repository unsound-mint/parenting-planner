package calendar

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

type EventUpdate struct {
	Title, Location, Visibility *string
	StartsAt, EndsAt            *time.Time
	AllDay, NeutralTitle        *bool
	Attendees                   *[]uuid.UUID
}

func keepOr[T any](old T, proposed *T) T {
	if proposed == nil {
		return old
	}
	return *proposed
}

func Update(ctx context.Context, pool *pgxpool.Pool, family, owner, id uuid.UUID, patch EventUpdate, now time.Time) (Event, error) {
	var out Event
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		e, err := q.LockOwnedCalendarEventVisibleToParent(ctx, store.LockOwnedCalendarEventVisibleToParentParams{FamilyID: family, OwnerMemberID: owner, ID: id})
		if err != nil {
			return err
		}
		old, err := q.CalendarEventAttendees(ctx, store.CalendarEventAttendeesParams{FamilyID: family, ID: id})
		if err != nil {
			return err
		}
		start := keepOr(e.StartsAt, patch.StartsAt)
		end, location := e.EndsAt, e.Location
		if patch.EndsAt != nil {
			end = toTS(patch.EndsAt)
		}
		if end.Valid && end.Time.Before(start) {
			return ErrBadTimes
		}
		if patch.Location != nil {
			location = patch.Location
		}
		visibility := keepOr(e.Visibility, patch.Visibility)
		attendees := keepOr(old, patch.Attendees)
		if visibility == "private" {
			attendees = nil
		}
		if patch.Attendees != nil && visibility == "family" {
			for _, member := range attendees {
				_, err := q.GetPerson(ctx, store.GetPersonParams{FamilyID: family, ID: member})
				if errors.Is(err, pgx.ErrNoRows) {
					return ErrBadAttendee
				}
				if err != nil {
					return err
				}
			}
		}
		next, err := q.UpdateOwnedCalendarEvent(ctx, store.UpdateOwnedCalendarEventParams{
			FamilyID: family, OwnerMemberID: owner, ID: id, Title: keepOr(e.Title, patch.Title), StartsAt: start, EndsAt: end,
			AllDay: keepOr(e.AllDay, patch.AllDay), Location: location, Visibility: visibility, NeutralTitle: keepOr(e.NeutralTitle, patch.NeutralTitle),
		})
		if err != nil {
			return err
		}
		if patch.Attendees != nil || visibility == "private" {
			if err := q.ClearCalendarEventAttendees(ctx, store.ClearCalendarEventAttendeesParams{FamilyID: family, ID: id}); err != nil {
				return err
			}
			for _, member := range attendees {
				if err := q.AddCalendarEventAttendee(ctx, store.AddCalendarEventAttendeeParams{EventID: id, MemberID: member}); err != nil {
					return err
				}
			}
		}
		out = fromRow(next, attendees)
		if err := access.Audit(ctx, q, family, owner, access.ActionUpdate, entity, id.String()); err != nil {
			return err
		}
		audience := []uuid.UUID{owner}
		if e.Visibility == "family" || visibility == "family" {
			audience, err = live.ParentsAnd(ctx, q, family, append(slices.Clone(old), attendees...)...)
			if err != nil {
				return err
			}
		}
		// The old audience must also invalidate its cached calendar when access is removed.
		return live.Publish(ctx, q, family, live.Event{Kind: live.CalendarEvent, EntityID: id.String(), Actor: owner, Audience: audience}, now)
	})
	return out, err
}
