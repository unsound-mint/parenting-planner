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
	"github.com/unsound-mint/parenting-planner/api/internal/directory"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
	"github.com/unsound-mint/parenting-planner/api/internal/shifts"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
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
	NeutralTitle bool
	ID           string
	Kind         string
	Title        string
	StartsAt     time.Time
	EndsAt       *time.Time
	AllDay       bool
	Location     *string
	OwnerID      *uuid.UUID
	AttendeeIDs  []uuid.UUID
	Visibility   string
	ShiftID      *uuid.UUID
	TaskID       *uuid.UUID
}

type NewEvent struct {
	NeutralTitle bool
	Kind         string
	Title        string
	StartsAt     time.Time
	EndsAt       *time.Time
	AllDay       bool
	Location     *string
	Attendees    []uuid.UUID
	Visibility   string
}

// Create stores an event owned by a parent. Attendees must be people of the family.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, ownerID uuid.UUID, in NewEvent, now time.Time) (Event, error) {
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
			StartsAt: in.StartsAt, EndsAt: toTS(in.EndsAt), AllDay: in.AllDay, Location: in.Location, NeutralTitle: in.NeutralTitle,
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
		if err := access.Audit(ctx, q, familyID, ownerID, access.ActionCreate, entity, e.ID.String()); err != nil {
			return err
		}
		// A private event is only the owner's business; a family event goes to both parents and the attendees.
		audience := []uuid.UUID{ownerID}
		if in.Visibility == "family" {
			if audience, err = live.ParentsAnd(ctx, q, familyID, in.Attendees...); err != nil {
				return err
			}
		}
		return live.Publish(ctx, q, familyID, live.Event{Kind: live.CalendarEvent, EntityID: e.ID.String(), Actor: ownerID, Audience: audience}, now)
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
		Location: e.Location, NeutralTitle: e.NeutralTitle, OwnerID: &owner, AttendeeIDs: attendees, Visibility: e.Visibility,
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
				StartsAt: r.StartsAt, EndsAt: r.EndsAt, AllDay: r.AllDay, Location: r.Location, NeutralTitle: r.NeutralTitle,
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
		shiftEvents, err := shiftEvents(ctx, q, familyID, viewer, scope, from, to)
		if err != nil {
			return err
		}
		out = append(out, shiftEvents...)
		taskEvents, err := taskEvents(ctx, q, familyID, viewer, scope, from, to)
		if err != nil {
			return err
		}
		out = append(out, taskEvents...)
		visits, err := providerVisits(ctx, q, familyID, viewer, scope, from, to)
		if err != nil {
			return err
		}
		out = append(out, visits...)
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

// providerVisits are directory bookings the viewer may see (directory.ListVisible
// applies access.CanParentRead): mine are the viewer's own, partner the ones the
// other parent shared, family both.
func providerVisits(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, scope Scope, from, to time.Time) ([]Event, error) {
	rows, err := directory.ListVisible(ctx, q, familyID, viewer, from, to)
	if err != nil {
		return nil, err
	}
	var out []Event
	for _, b := range rows {
		own := b.OwnerMemberID == viewer
		if (scope == Mine && !own) || (scope == Partner && own) {
			continue
		}
		end := b.StartsAt.Add(time.Duration(b.DurationMinutes) * time.Minute)
		owner := b.OwnerMemberID
		vis := "private"
		if b.Visibility != "private" {
			vis = "family"
		}
		out = append(out, Event{
			ID: b.ID.String(), Kind: "provider_visit", Title: "Visit with " + b.ProviderName,
			StartsAt: b.StartsAt, EndsAt: &end, OwnerID: &owner, AttendeeIDs: []uuid.UUID{}, Visibility: vis,
		})
	}
	return out, nil
}

// shiftEvents turns active shifts into one event per occurrence. mine is the
// viewer's own; partner is the other parent's; family is everyone's.
func shiftEvents(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, scope Scope, from, to time.Time) ([]Event, error) {
	active, err := q.ListActiveShifts(ctx, familyID)
	if err != nil {
		return nil, err
	}
	parents, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	isParent := map[uuid.UUID]bool{}
	for _, p := range parents {
		isParent[p.ID] = true
	}
	var out []Event
	for _, sh := range active {
		switch {
		case scope == Mine && sh.MemberID != viewer, scope == Partner && (sh.MemberID == viewer || !isParent[sh.MemberID]):
			continue
		}
		out = append(out, occurrenceEvents(sh, from, to)...)
	}
	return out, nil
}

// taskEvents turns open tasks with a deadline in the window into all-day events:
// mine are the viewer's own, partner the other parent's, family everyone's.
func taskEvents(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, scope Scope, from, to time.Time) ([]Event, error) {
	items, err := tasks.ListWith(ctx, q, familyID, nil)
	if err != nil {
		return nil, err
	}
	parents, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	isParent := map[uuid.UUID]bool{}
	for _, p := range parents {
		isParent[p.ID] = true
	}
	var out []Event
	for _, it := range items {
		switch {
		case scope == Mine && it.AssigneeMemberID != viewer, scope == Partner && (it.AssigneeMemberID == viewer || !isParent[it.AssigneeMemberID]):
			continue
		}
		if ev, ok := taskEvent(it, from, to); ok {
			out = append(out, ev)
		}
	}
	return out, nil
}

func taskEvent(it tasks.Item, from, to time.Time) (Event, bool) {
	if it.Done || it.Kind == "hospital_bag" || it.Deadline.On == nil {
		return Event{}, false
	}
	day := time.Date(it.Deadline.On.Year(), it.Deadline.On.Month(), it.Deadline.On.Day(), 0, 0, 0, 0, time.UTC)
	if day.Before(from) || !day.Before(to) {
		return Event{}, false
	}
	owner, id := it.AssigneeMemberID, it.ID
	return Event{
		ID: id.String(), Kind: "task", Title: it.Title, StartsAt: day, AllDay: true, OwnerID: &owner,
		AttendeeIDs: []uuid.UUID{owner}, Visibility: "family", TaskID: &id,
	}, true
}

func occurrenceEvents(sh store.Shift, from, to time.Time) []Event {
	var out []Event
	for _, o := range shifts.Occurrences(sh, from, to) {
		owner, id := sh.MemberID, sh.ID
		end := o.End
		out = append(out, Event{
			ID: sh.ID.String() + ":" + o.Date.Format("2006-01-02"), Kind: "shift", Title: sh.Title,
			StartsAt: o.Start, EndsAt: &end, OwnerID: &owner, AttendeeIDs: []uuid.UUID{owner}, Visibility: "family", ShiftID: &id,
		})
	}
	return out
}

// ListForCaregiver returns the events a grandparent or nanny attends. It never
// includes a parent's appointments or private events.
func ListForCaregiver(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, from, to time.Time) ([]Event, error) {
	if !to.After(from) || to.Sub(from) > MaxWindow {
		return nil, ErrBadWindow
	}
	// The events are parents' records a caregiver may see: the read goes in the
	// access log in the same transaction, like a parent's List.
	var rows []store.ListCaregiverCalendarEventsVisibleToParentRow
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		rows, err = q.ListCaregiverCalendarEventsVisibleToParent(ctx, store.ListCaregiverCalendarEventsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, FromAt: from, ToAt: to,
		})
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	if err != nil {
		return nil, err
	}
	out := make([]Event, 0, len(rows))
	for _, r := range rows {
		out = append(out, fromRow(store.CalendarEvent{
			ID: r.ID, OwnerMemberID: r.OwnerMemberID, Visibility: r.Visibility, Kind: r.Kind, Title: r.Title,
			StartsAt: r.StartsAt, EndsAt: r.EndsAt, AllDay: r.AllDay, Location: r.Location, NeutralTitle: r.NeutralTitle,
		}, r.AttendeeIds))
	}
	// Their own shifts too.
	active, err := store.New(pool).ListActiveShifts(ctx, familyID)
	if err != nil {
		return nil, err
	}
	for _, sh := range active {
		if sh.MemberID == viewer {
			out = append(out, occurrenceEvents(sh, from, to)...)
		}
	}
	// Open tasks assigned to them.
	items, err := tasks.ListWith(ctx, store.New(pool), familyID, nil)
	if err != nil {
		return nil, err
	}
	for _, it := range items {
		if it.AssigneeMemberID == viewer {
			if ev, ok := taskEvent(it, from, to); ok {
				out = append(out, ev)
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].StartsAt.Before(out[j].StartsAt) })
	return out, nil
}

// NextShift returns the person's next shift occurrence that has not ended yet,
// looking a week ahead; nil when they have none. It never touches audit: it is
// the person's own schedule.
func NextShift(ctx context.Context, pool *pgxpool.Pool, familyID, member uuid.UUID, now time.Time) (*Event, error) {
	active, err := store.New(pool).ListActiveShifts(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var best *Event
	for _, sh := range active {
		if sh.MemberID != member {
			continue
		}
		for _, ev := range occurrenceEvents(sh, now.AddDate(0, 0, -1), now.AddDate(0, 0, 8)) {
			if ev.EndsAt != nil && ev.EndsAt.After(now) && (best == nil || ev.StartsAt.Before(best.StartsAt)) {
				e := ev
				best = &e
			}
		}
	}
	return best, nil
}
