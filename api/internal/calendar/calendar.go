// Package calendar builds the one feed behind Mine, Partner and Family: events
// parents stored, plus the acting parent's own psychologist sessions. Shifts
// and task due dates are merged in when those modules land.
//
// Built like internal/wellbeing: reads use the *VisibleToParent SQL, then keep
// only what the scope asks for; a parent's reads and creates run in one
// transaction with access.Audit.
package calendar

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "calendar_event"

// MaxWindow is the longest range one request may ask for.
const MaxWindow = 31 * 24 * time.Hour

var (
	ErrBadAttendee = errors.New("attendee is not in this family")
	ErrBadTimes    = errors.New("endsAt is before startsAt")
	ErrBadWindow   = errors.New("window is empty or longer than 31 days")
)

type Scope string

const (
	Mine    Scope = "mine"
	Partner Scope = "partner"
	Family  Scope = "family"
)

// Event is one line of the feed.
type Event struct {
	ID          string
	Kind        string
	Title       string
	StartsAt    time.Time
	EndsAt      *time.Time
	AllDay      bool
	Location    *string
	OwnerID     *uuid.UUID
	AttendeeIDs []uuid.UUID
	Visibility  string
}

type NewEvent struct {
	Kind       string
	Title      string
	StartsAt   time.Time
	EndsAt     *time.Time
	AllDay     bool
	Location   *string
	Attendees  []uuid.UUID
	Visibility string
}

// Create stores an event owned by a parent. Attendees must be people of the family.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, ownerID uuid.UUID, in NewEvent) (Event, error) {
	if in.EndsAt != nil && in.EndsAt.Before(in.StartsAt) {
		return Event{}, ErrBadTimes
	}
	var out Event
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		for _, a := range in.Attendees {
			if _, err := q.GetPerson(ctx, store.GetPersonParams{ID: a, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
				return ErrBadAttendee
			} else if err != nil {
				return err
			}
		}
		e, err := q.CreateCalendarEvent(ctx, store.CreateCalendarEventParams{
			FamilyID: familyID, OwnerMemberID: ownerID, Visibility: in.Visibility, Kind: in.Kind, Title: in.Title,
			StartsAt: in.StartsAt, EndsAt: toTS(in.EndsAt), AllDay: in.AllDay, Location: in.Location,
		})
		if err != nil {
			return err
		}
		for _, a := range in.Attendees {
			if err := q.AddCalendarEventAttendee(ctx, store.AddCalendarEventAttendeeParams{EventID: e.ID, MemberID: a}); err != nil {
				return err
			}
		}
		out = fromRow(e, in.Attendees)
		return access.Audit(ctx, q, familyID, ownerID, access.ActionCreate, entity, e.ID.String())
	})
	return out, err
}

func fromRow(e store.CalendarEvent, attendees []uuid.UUID) Event {
	owner := e.OwnerMemberID
	if attendees == nil {
		attendees = []uuid.UUID{}
	}
	return Event{
		ID: e.ID.String(), Kind: e.Kind, Title: e.Title, StartsAt: e.StartsAt, EndsAt: fromTS(e.EndsAt), AllDay: e.AllDay,
		Location: e.Location, OwnerID: &owner, AttendeeIDs: attendees, Visibility: e.Visibility,
	}
}

func toTS(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func fromTS(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func contains(ids []uuid.UUID, id uuid.UUID) bool {
	for _, x := range ids {
		if x == id {
			return true
		}
	}
	return false
}

// ListForParent returns the feed for the acting parent in [from, to). The scope
// narrows what access.CanParentRead already allows.
func ListForParent(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, scope Scope, from, to time.Time) ([]Event, error) {
	if !to.After(from) || to.Sub(from) > MaxWindow {
		return nil, ErrBadWindow
	}
	var out []Event
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListCalendarEventsVisibleToParent(ctx, store.ListCalendarEventsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, FromAt: from, ToAt: to,
		})
		if err != nil {
			return err
		}
		for _, r := range rows {
			ev := fromRow(store.CalendarEvent{
				ID: r.ID, OwnerMemberID: r.OwnerMemberID, Visibility: r.Visibility, Kind: r.Kind, Title: r.Title,
				StartsAt: r.StartsAt, EndsAt: r.EndsAt, AllDay: r.AllDay, Location: r.Location,
			}, r.AttendeeIds)
			own := r.OwnerMemberID == viewer
			switch scope {
			case Mine:
				if !own && !contains(r.AttendeeIds, viewer) {
					continue
				}
			case Partner:
				if own {
					continue
				}
			}
			out = append(out, ev)
		}
		if scope != Partner { // psychologist sessions are the owner's own, always private
			sessions, err := ownSessions(ctx, q, familyID, viewer, from, to)
			if err != nil {
				return err
			}
			out = append(out, sessions...)
		}
		sort.SliceStable(out, func(i, j int) bool { return out[i].StartsAt.Before(out[j].StartsAt) })
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return out, err
}

func ownSessions(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, from, to time.Time) ([]Event, error) {
	bookings, err := q.ListPsychologistBookingsVisibleToParent(ctx, store.ListPsychologistBookingsVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
	if err != nil {
		return nil, err
	}
	psy, err := q.ListPsychologists(ctx)
	if err != nil {
		return nil, err
	}
	names := map[uuid.UUID]string{}
	for _, p := range psy {
		names[p.ID] = p.Name
	}
	var out []Event
	for _, b := range bookings {
		if b.OwnerMemberID != viewer || b.StartsAt.Before(from) || !b.StartsAt.Before(to) {
			continue
		}
		end := b.StartsAt.Add(time.Duration(b.DurationMinutes) * time.Minute)
		owner := b.OwnerMemberID
		out = append(out, Event{
			ID: b.ID.String(), Kind: "psychologist_session", Title: "Session with " + names[b.PsychologistID],
			StartsAt: b.StartsAt, EndsAt: &end, OwnerID: &owner, AttendeeIDs: []uuid.UUID{}, Visibility: "private",
		})
	}
	return out, nil
}

// ListForCaregiver returns the events a grandparent or nanny attends. It never
// includes a parent's appointments or private events.
func ListForCaregiver(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, from, to time.Time) ([]Event, error) {
	if !to.After(from) || to.Sub(from) > MaxWindow {
		return nil, ErrBadWindow
	}
	rows, err := store.New(pool).ListCaregiverCalendarEventsVisibleToParent(ctx, store.ListCaregiverCalendarEventsVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer, FromAt: from, ToAt: to,
	})
	if err != nil {
		return nil, err
	}
	out := make([]Event, 0, len(rows))
	for _, r := range rows {
		out = append(out, fromRow(store.CalendarEvent{
			ID: r.ID, OwnerMemberID: r.OwnerMemberID, Visibility: r.Visibility, Kind: r.Kind, Title: r.Title,
			StartsAt: r.StartsAt, EndsAt: r.EndsAt, AllDay: r.AllDay, Location: r.Location,
		}, r.AttendeeIds))
	}
	return out, nil
}
