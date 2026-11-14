// Package carelog owns the baby's care log (feeds, sleeps, diapers) and the
// handoffs between the people who look after the baby.
//
// Not sensitive per-parent data: everyone with the care_log permission sees
// every entry. Each change or read by a grandparent or nanny is still written
// to audit_log in the same transaction, so parents can see it in the access log.
package carelog

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
	"github.com/unsound-mint/parenting-planner/api/internal/shifts"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	entityEntry   = "care_log_entry"
	entityHandoff = "handoff"
)

// Window is how far back the log and the handoffs go.
const Window = 48 * time.Hour

var (
	ErrNoChild           = errors.New("no child yet")
	ErrBadChild          = errors.New("no such child in this family")
	ErrMissingDetail     = errors.New("a feed needs feedMethod and a diaper needs diaper")
	ErrBadTimes          = errors.New("endedAt is before startedAt")
	ErrHandoffInvalid    = errors.New("handoff is not allowed")
	ErrNoHandoff         = errors.New("no such handoff")
	ErrNotRecipient      = errors.New("only the receiver can accept")
	ErrHandoffNotPending = errors.New("handoff is not pending")
)

// Person is whoever acts: a parent or a caregiver.
type Person struct {
	ID          uuid.UUID
	Role        string
	Permissions []string
}

func (p Person) isParent() bool { return p.Role == "mother" || p.Role == "partner" }

// CanUse reports whether the person may use the care log: parents always, a
// caregiver with care_log.
func (p Person) CanUse() bool { return p.isParent() || slices.Contains(p.Permissions, "care_log") }

func audit(ctx context.Context, q *store.Queries, familyID uuid.UUID, p Person, action, entity, id string) error {
	if p.isParent() {
		return nil
	}
	return access.Audit(ctx, q, familyID, p.ID, action, entity, id)
}

type NewEntry struct {
	ChildID    *uuid.UUID
	Kind       string
	StartedAt  time.Time
	EndedAt    *time.Time
	FeedMethod *string
	AmountMl   *int16
	Diaper     *string
	Note       *string
}

func amountOf(a *int16) pgtype.Int2 {
	if a == nil {
		return pgtype.Int2{}
	}
	return pgtype.Int2{Int16: *a, Valid: true}
}

func tsOf(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

// CreateEntry logs a feed, sleep or diaper for the family's child.
func CreateEntry(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, in NewEntry, now time.Time) (store.CareLogEntry, error) {
	switch {
	case in.Kind == "feed" && in.FeedMethod == nil, in.Kind == "diaper" && in.Diaper == nil:
		return store.CareLogEntry{}, ErrMissingDetail
	case in.EndedAt != nil && in.EndedAt.Before(in.StartedAt):
		return store.CareLogEntry{}, ErrBadTimes
	}
	var out store.CareLogEntry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		children, err := q.ListChildren(ctx, familyID) // oldest first
		if err != nil {
			return err
		}
		if len(children) == 0 {
			return ErrNoChild
		}
		child := children[len(children)-1] // the youngest, which is the only child in most families
		if in.ChildID != nil {
			i := slices.IndexFunc(children, func(c store.Child) bool { return c.ID == *in.ChildID })
			if i < 0 {
				return ErrBadChild
			}
			child = children[i]
		}
		out, err = q.CreateCareLogEntry(ctx, store.CreateCareLogEntryParams{
			FamilyID: familyID, ChildID: child.ID, AuthorMemberID: p.ID, Kind: in.Kind, StartedAt: in.StartedAt,
			EndedAt: tsOf(in.EndedAt), FeedMethod: in.FeedMethod, AmountMl: amountOf(in.AmountMl), Diaper: in.Diaper, Note: in.Note,
		})
		if err != nil {
			return err
		}
		if err := audit(ctx, q, familyID, p, access.ActionCreate, entityEntry, out.ID.String()); err != nil {
			return err
		}
		return live.Publish(ctx, q, familyID, live.Event{Kind: live.CareLog, EntityID: out.ID.String(), Actor: p.ID, NeedsPermission: "care_log"}, now)
	})
	return out, err
}

// Summary is the latest of each kind and who has the baby now.
type Summary struct {
	LastFeed, LastSleep, LastDiaper *store.CareLogEntry
	OnDuty                          *OnDuty // nil when nobody is known to have the baby
}

// OnDuty is who has the baby now: the receiver of the last accepted handoff, or
// the person whose shift covers now when no handoff came after the shift began.
type OnDuty struct {
	MemberID uuid.UUID
	Since    time.Time
	Via      string // "handoff" or "shift"
}

func summary(ctx context.Context, q *store.Queries, familyID uuid.UUID, now time.Time) (Summary, error) {
	var s Summary
	for kind, dst := range map[string]**store.CareLogEntry{"feed": &s.LastFeed, "sleep": &s.LastSleep, "diaper": &s.LastDiaper} {
		e, err := q.LatestCareLogEntry(ctx, store.LatestCareLogEntryParams{FamilyID: familyID, Kind: kind})
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return s, err
		}
		*dst = &e
	}
	h, err := q.LastAcceptedHandoff(ctx, familyID)
	switch {
	case err == nil && h.AcceptedAt.Valid:
		s.OnDuty = &OnDuty{MemberID: h.ToMemberID, Since: h.AcceptedAt.Time, Via: "handoff"}
	case err != nil && !errors.Is(err, pgx.ErrNoRows):
		return s, err
	}
	active, err := q.ListActiveShifts(ctx, familyID)
	if err != nil {
		return s, err
	}
	for _, sh := range active {
		o, ok := shifts.Current(sh, now)
		if !ok {
			continue
		}
		// A handoff accepted after the shift began wins; otherwise the latest-starting shift does.
		if s.OnDuty == nil || (s.OnDuty.Via == "shift" && o.Start.After(s.OnDuty.Since)) || (s.OnDuty.Via == "handoff" && o.Start.After(s.OnDuty.Since)) {
			s.OnDuty = &OnDuty{MemberID: sh.MemberID, Since: o.Start, Via: "shift"}
		}
	}
	return s, nil
}

// ListEntries returns the last 48 hours, newest first, and the latest of each kind.
func ListEntries(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, kind *string, now time.Time) ([]store.CareLogEntry, Summary, error) {
	var items []store.CareLogEntry
	var sum Summary
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		items, err = q.ListCareLogEntries(ctx, store.ListCareLogEntriesParams{FamilyID: familyID, Since: now.Add(-Window), Kind: kind})
		if err != nil {
			return err
		}
		if sum, err = summary(ctx, q, familyID, now); err != nil {
			return err
		}
		return audit(ctx, q, familyID, p, access.ActionRead, entityEntry, "")
	})
	return items, sum, err
}

// Handoff is a handoff with the metadata of its voice note, if it has one.
type Handoff struct {
	store.Handoff
	VoiceNote *store.ListHandoffVoiceNotesRow
}

// withNotes pairs each handoff with its voice note in one query (never the audio).
func withNotes(ctx context.Context, q *store.Queries, familyID uuid.UUID, hs []store.Handoff) ([]Handoff, error) {
	out := make([]Handoff, len(hs))
	ids := make([]uuid.UUID, len(hs))
	for i, h := range hs {
		out[i] = Handoff{Handoff: h}
		ids[i] = h.ID
	}
	if len(ids) == 0 {
		return out, nil
	}
	notes, err := q.ListHandoffVoiceNotes(ctx, store.ListHandoffVoiceNotesParams{FamilyID: familyID, HandoffIds: ids})
	if err != nil {
		return nil, err
	}
	for i := range notes {
		if j := slices.IndexFunc(out, func(h Handoff) bool { return h.ID == notes[i].HandoffID.UUID }); j >= 0 {
			out[j].VoiceNote = &notes[i]
		}
	}
	return out, nil
}

// CreateHandoff hands the baby to another person who has care_log. now is the
// family's clock; it becomes created_at so the 48-hour window and the pending
// check agree. A voice note, when given, must be the sender's own unattached one.
func CreateHandoff(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, from Person, to uuid.UUID, note *string, shiftID, voiceNoteID *uuid.UUID, now time.Time) (Handoff, error) {
	var out Handoff
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if to == from.ID {
			return ErrHandoffInvalid
		}
		target, err := q.GetPerson(ctx, store.GetPersonParams{ID: to, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrHandoffInvalid
		}
		if err != nil {
			return err
		}
		if !(Person{ID: target.ID, Role: target.Role, Permissions: target.Permissions}).CanUse() {
			return ErrHandoffInvalid
		}
		pending, err := q.CountPendingHandoffsFrom(ctx, store.CountPendingHandoffsFromParams{FamilyID: familyID, FromMemberID: from.ID})
		if err != nil {
			return err
		}
		if pending > 0 {
			return ErrHandoffInvalid
		}
		var sid uuid.NullUUID
		if shiftID != nil {
			sid = uuid.NullUUID{UUID: *shiftID, Valid: true}
		}
		h, err := q.CreateHandoff(ctx, store.CreateHandoffParams{FamilyID: familyID, FromMemberID: from.ID, ToMemberID: to, Note: note, ShiftID: sid, CreatedAt: now})
		if err != nil {
			return err
		}
		if voiceNoteID != nil {
			n, err := q.AttachVoiceNoteToHandoff(ctx, store.AttachVoiceNoteToHandoffParams{
				HandoffID: uuid.NullUUID{UUID: h.ID, Valid: true}, VoiceNoteID: *voiceNoteID, FamilyID: familyID, UploaderID: from.ID,
			})
			if err != nil {
				return err
			}
			if n == 0 {
				return ErrHandoffInvalid // someone else's, already attached, or deleted
			}
		}
		hs, err := withNotes(ctx, q, familyID, []store.Handoff{h})
		if err != nil {
			return err
		}
		out = hs[0]
		if err := audit(ctx, q, familyID, from, access.ActionCreate, entityHandoff, h.ID.String()); err != nil {
			return err
		}
		return live.Publish(ctx, q, familyID, live.Event{Kind: live.Handoff, EntityID: h.ID.String(), Actor: from.ID, NeedsPermission: "care_log"}, now)
	})
	return out, err
}

// ListHandoffs: parents see every handoff of the family, a caregiver those to or from them.
func ListHandoffs(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, now time.Time) ([]Handoff, Summary, error) {
	var items []Handoff
	var sum Summary
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var involving uuid.NullUUID
		if !p.isParent() {
			involving = uuid.NullUUID{UUID: p.ID, Valid: true}
		}
		rows, err := q.ListHandoffs(ctx, store.ListHandoffsParams{FamilyID: familyID, Since: now.Add(-Window), Involving: involving})
		if err != nil {
			return err
		}
		if items, err = withNotes(ctx, q, familyID, rows); err != nil {
			return err
		}
		if sum, err = summary(ctx, q, familyID, now); err != nil {
			return err
		}
		return audit(ctx, q, familyID, p, access.ActionRead, entityHandoff, "")
	})
	return items, sum, err
}

// AcceptHandoff makes the receiver the person on duty.
func AcceptHandoff(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id uuid.UUID, now time.Time) (Handoff, Summary, error) {
	var out Handoff
	var sum Summary
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		h, err := q.GetHandoffForUpdate(ctx, store.GetHandoffForUpdateParams{ID: id, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoHandoff
		}
		if err != nil {
			return err
		}
		if h.ToMemberID != p.ID {
			return ErrNotRecipient
		}
		if h.Status != "pending" {
			return ErrHandoffNotPending
		}
		accepted, err := q.AcceptHandoff(ctx, store.AcceptHandoffParams{ID: id, AcceptedAt: pgtype.Timestamptz{Time: now, Valid: true}})
		if err != nil {
			return err
		}
		hs, err := withNotes(ctx, q, familyID, []store.Handoff{accepted})
		if err != nil {
			return err
		}
		out = hs[0]
		if sum, err = summary(ctx, q, familyID, now); err != nil {
			return err
		}
		if err := audit(ctx, q, familyID, p, access.ActionUpdate, entityHandoff, id.String()); err != nil {
			return err
		}
		return live.Publish(ctx, q, familyID, live.Event{Kind: live.Handoff, EntityID: id.String(), Actor: p.ID, NeedsPermission: "care_log"}, now)
	})
	return out, sum, err
}

// LatestSummary is the latest of each kind and who is on duty, read on its own.
func LatestSummary(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, now time.Time) (Summary, error) {
	return summary(ctx, store.New(pool), familyID, now)
}

// PendingFor lists handoffs to a person that they have not accepted yet. It is
// the person's own inbox, so it is not written to the access log.
func PendingFor(ctx context.Context, pool *pgxpool.Pool, familyID, person uuid.UUID, now time.Time) ([]store.Handoff, error) {
	all, err := store.New(pool).ListHandoffs(ctx, store.ListHandoffsParams{
		FamilyID: familyID, Since: now.Add(-Window), Involving: uuid.NullUUID{UUID: person, Valid: true},
	})
	if err != nil {
		return nil, err
	}
	var out []store.Handoff
	for _, h := range all {
		if h.ToMemberID == person && h.Status == "pending" {
			out = append(out, h)
		}
	}
	return out, nil
}
