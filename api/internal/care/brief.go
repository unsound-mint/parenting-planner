package care

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"time"
	_ "time/tzdata" // the families' Eastern days, also in a container without zoneinfo

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// The session brief: what a parent chooses to send their psychologist before
// a session. Nothing leaves the app until the parent schedules or sends it;
// from then on it is a frozen copy (snapshot_sealed), so what was sent never
// changes when the journal does. "Sent" needs no worker: a scheduled brief
// counts as sent once its send time passes on the family's clock.

const entityBrief = "session_brief"

// Brief statuses, as stored and as in the contract.
const (
	BriefDraft     = "draft"
	BriefScheduled = "scheduled"
	BriefSent      = "sent"
)

// SendAhead is how long before the session a scheduled brief goes out.
const SendAhead = 24 * time.Hour

var (
	ErrBriefSent    = errors.New("brief already sent")
	ErrNoSession    = errors.New("no upcoming session")
	ErrUnknownEntry = errors.New("entry is not on the agenda")
)

var eastern = func() *time.Location {
	if l, err := time.LoadLocation("America/New_York"); err == nil {
		return l
	}
	return time.UTC
}()

type BriefItem struct {
	Text         string        `json:"text"`
	DiaryEntryID uuid.NullUUID `json:"diaryEntryId"`
	WrittenAt    *time.Time    `json:"writtenAt,omitempty"`
	EntryText    string        `json:"entryText,omitempty"`
}

type MoodDay struct {
	Day  time.Time `json:"day"`
	Mood float64   `json:"mood"`
}

// MoodSummary describes what the parent logged; it never assesses it.
type MoodSummary struct {
	From         time.Time `json:"from"`
	To           time.Time `json:"to"`
	Checkins     int       `json:"checkins"`
	LowDays      int       `json:"lowDays"`
	AverageSleep *float64  `json:"averageSleep,omitempty"`
	Days         []MoodDay `json:"days"`
}

// snapshot is the frozen content of a scheduled or sent brief.
type snapshot struct {
	Items []BriefItem  `json:"items"`
	Mood  *MoodSummary `json:"mood,omitempty"`
}

type Brief struct {
	Status      string
	Session     *Booking
	SendAt      *time.Time
	SentAt      *time.Time
	IncludeMood bool
	EntryIDs    []uuid.UUID
	Note        string
	Items       []BriefItem
	// Mood is the live summary in a draft (so the parent can see what adding
	// it would send) and the frozen one, only when included, after that.
	Mood      *MoodSummary
	UpdatedAt *time.Time
}

// BriefInput is what the parent saves.
type BriefInput struct {
	Status      string
	IncludeMood bool
	EntryIDs    []uuid.UUID
	Note        string
}

type current struct {
	row    *store.GetLatestSessionBriefVisibleToParentRow
	status string // effective: a scheduled brief past its send time is sent
	sentAt *time.Time
}

func ts(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

// loadCurrent finds the parent's current brief: the newest one, unless its
// session is over or it was sent for a session that no longer exists.
func loadCurrent(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, now time.Time) (current, error) {
	row, err := q.GetLatestSessionBriefVisibleToParent(ctx, store.GetLatestSessionBriefVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
	if errors.Is(err, pgx.ErrNoRows) {
		return current{status: BriefDraft}, nil
	}
	if err != nil {
		return current{}, err
	}
	c := current{row: &row, status: row.Status, sentAt: ts(row.SentAt)}
	if row.Status == BriefScheduled && row.SendAt.Valid && !row.SendAt.Time.After(now) {
		c.status, c.sentAt = BriefSent, ts(row.SendAt)
	}
	over := row.SessionStartsAt.Valid && !row.SessionStartsAt.Time.After(now)
	if over || (c.status == BriefSent && !row.BookingID.Valid) {
		return current{status: BriefDraft}, nil
	}
	return c, nil
}

// GetBrief returns the acting parent's current brief, an empty draft when
// nothing is saved.
func GetBrief(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, viewer uuid.UUID, now time.Time) (Brief, error) {
	var out Brief
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		c, err := loadCurrent(ctx, q, familyID, viewer, now)
		if err != nil {
			return err
		}
		if out, err = view(ctx, q, key, familyID, viewer, now, c); err != nil {
			return err
		}
		for _, e := range []string{entityBrief, entityBooking, entityMoodCheckin, entityDiaryEntry} {
			if err := access.Audit(ctx, q, familyID, viewer, access.ActionRead, e, ""); err != nil {
				return err
			}
		}
		return nil
	})
	return out, err
}

// SaveBrief stores the parent's choices and, for scheduled or sent, freezes
// what goes to the psychologist.
func SaveBrief(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor uuid.UUID, in BriefInput, now time.Time) (Brief, error) {
	var out Brief
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		c, err := loadCurrent(ctx, q, familyID, actor, now)
		if err != nil {
			return err
		}
		if c.status == BriefSent {
			return ErrBriefSent
		}
		agenda, err := buildAgenda(ctx, q, familyID, actor, now)
		if err != nil {
			return err
		}
		onAgenda := map[uuid.UUID]bool{}
		for _, t := range agenda.Topics {
			if t.DiaryEntryID.Valid {
				onAgenda[t.DiaryEntryID.UUID] = true
			}
		}
		ids := []uuid.UUID{}
		seen := map[uuid.UUID]bool{}
		for _, id := range in.EntryIDs {
			if !onAgenda[id] {
				return ErrUnknownEntry
			}
			if !seen[id] {
				seen[id] = true
				ids = append(ids, id)
			}
		}

		session := agenda.NextSession
		if c.row != nil && c.row.BookingID.Valid {
			if b := findBooking(ctx, q, familyID, actor, c.row.BookingID.UUID); b != nil && b.StartsAt.After(now) {
				session = b
			}
		}
		var bookingID uuid.NullUUID
		if session != nil {
			bookingID = uuid.NullUUID{UUID: session.ID, Valid: true}
		}

		var noteSealed []byte
		if in.Note != "" {
			if noteSealed, err = key.Seal(in.Note); err != nil {
				return err
			}
		}
		var sendAt, sentAt pgtype.Timestamptz
		var snap []byte
		status := in.Status
		if status != BriefDraft && session == nil {
			return ErrNoSession // a brief goes with a session
		}
		if status == BriefScheduled {
			at := session.StartsAt.Add(-SendAhead)
			if !at.After(now) {
				// Less than a day to go: it goes out now.
				status, at = BriefSent, now
				sentAt = pgtype.Timestamptz{Time: now, Valid: true}
			}
			sendAt = pgtype.Timestamptz{Time: at, Valid: true}
		}
		if status == BriefSent {
			sentAt = pgtype.Timestamptz{Time: now, Valid: true}
		}
		if status != BriefDraft {
			items, err := liveItems(ctx, q, key, familyID, actor, agenda.Topics, ids)
			if err != nil {
				return err
			}
			s := snapshot{Items: items}
			if in.IncludeMood {
				if s.Mood, err = moodSummary(ctx, q, familyID, actor, now); err != nil {
					return err
				}
			}
			raw, err := json.Marshal(s)
			if err != nil {
				return err
			}
			if snap, err = key.Seal(string(raw)); err != nil {
				return err
			}
		}

		action := access.ActionUpdate
		if c.row == nil {
			action = access.ActionCreate
			_, err = q.CreateSessionBrief(ctx, store.CreateSessionBriefParams{
				FamilyID: familyID, OwnerMemberID: actor, BookingID: bookingID, IncludeMood: in.IncludeMood, EntryIds: ids,
				NoteSealed: noteSealed, Status: status, SendAt: sendAt, SentAt: sentAt, SnapshotSealed: snap, Now: now,
			})
		} else {
			_, err = q.UpdateOwnSessionBrief(ctx, store.UpdateOwnSessionBriefParams{
				ID: c.row.ID, FamilyID: familyID, OwnerMemberID: actor, BookingID: bookingID, IncludeMood: in.IncludeMood, EntryIds: ids,
				NoteSealed: noteSealed, Status: status, SendAt: sendAt, SentAt: sentAt, SnapshotSealed: snap, Now: now,
			})
		}
		if err != nil {
			return err
		}
		if err := access.Audit(ctx, q, familyID, actor, action, entityBrief, ""); err != nil {
			return err
		}
		if c, err = loadCurrent(ctx, q, familyID, actor, now); err != nil {
			return err
		}
		if out, err = view(ctx, q, key, familyID, actor, now, c); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionRead, entityDiaryEntry, "")
	})
	return out, err
}

func findBooking(ctx context.Context, q *store.Queries, familyID, viewer, id uuid.UUID) *Booking {
	bookings, err := OwnBookings(ctx, q, familyID, viewer)
	if err != nil {
		return nil
	}
	for i := range bookings {
		if bookings[i].ID == id {
			return &bookings[i]
		}
	}
	return nil
}

// view turns the current brief into what the parent sees: live content for a
// draft, the frozen copy after that.
func view(ctx context.Context, q *store.Queries, key crypt.Key, familyID, viewer uuid.UUID, now time.Time, c current) (Brief, error) {
	out := Brief{Status: c.status, EntryIDs: []uuid.UUID{}, Items: []BriefItem{}}
	agenda, err := buildAgenda(ctx, q, familyID, viewer, now)
	if err != nil {
		return out, err
	}
	out.Session = agenda.NextSession
	if r := c.row; r != nil {
		out.IncludeMood, out.EntryIDs, out.UpdatedAt = r.IncludeMood, r.EntryIds, &r.UpdatedAt
		if out.EntryIDs == nil {
			out.EntryIDs = []uuid.UUID{}
		}
		if r.BookingID.Valid {
			if b := findBooking(ctx, q, familyID, viewer, r.BookingID.UUID); b != nil {
				out.Session = b
			}
		}
		if len(r.NoteSealed) > 0 {
			note, err := key.Open(r.NoteSealed)
			if err != nil && !errors.Is(err, crypt.ErrCannotDecrypt) {
				return out, err
			}
			out.Note = note
		}
		if c.status != BriefDraft {
			out.SendAt, out.SentAt = ts(r.SendAt), c.sentAt
			if c.status == BriefSent {
				out.SendAt = nil
			}
			raw, err := key.Open(r.SnapshotSealed)
			if errors.Is(err, crypt.ErrCannotDecrypt) {
				return out, nil // sealed with an earlier key: show the brief without its content
			}
			if err != nil {
				return out, err
			}
			var s snapshot
			if err := json.Unmarshal([]byte(raw), &s); err != nil {
				return out, err
			}
			out.Items, out.Mood = s.Items, s.Mood
			if out.Items == nil {
				out.Items = []BriefItem{}
			}
			return out, nil
		}
	}
	if out.Items, err = liveItems(ctx, q, key, familyID, viewer, agenda.Topics, out.EntryIDs); err != nil {
		return out, err
	}
	out.Mood, err = moodSummary(ctx, q, familyID, viewer, now)
	return out, err
}

// liveItems lists the agenda topics in their order, with the text of the
// entries the parent chose to send.
func liveItems(ctx context.Context, q *store.Queries, key crypt.Key, familyID, viewer uuid.UUID, topics []Topic, shared []uuid.UUID) ([]BriefItem, error) {
	texts := map[uuid.UUID]string{}
	if len(shared) > 0 {
		rows, err := q.ListOwnDiaryEntriesByIDVisibleToParent(ctx, store.ListOwnDiaryEntriesByIDVisibleToParentParams{FamilyID: familyID, ViewerID: viewer, Ids: shared})
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			body, err := key.Open(r.BodySealed)
			if errors.Is(err, crypt.ErrCannotDecrypt) {
				continue
			}
			if err != nil {
				return nil, err
			}
			texts[r.ID] = body
		}
	}
	out := make([]BriefItem, 0, len(topics))
	for _, t := range topics {
		it := BriefItem{Text: t.Text, DiaryEntryID: t.DiaryEntryID}
		if t.DiaryEntryID.Valid {
			at := t.AddedAt
			it.WrittenAt = &at
			it.EntryText = texts[t.DiaryEntryID.UUID]
		}
		out = append(out, it)
	}
	return out, nil
}

// moodSummary describes the parent's own check-ins over the last two weeks,
// by Eastern day.
func moodSummary(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, now time.Time) (*MoodSummary, error) {
	rows, err := q.ListMoodCheckinsVisibleToParent(ctx, store.ListMoodCheckinsVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer, Since: now.Add(-moodWindow),
	})
	if err != nil {
		return nil, err
	}
	day := func(t time.Time) time.Time {
		y, m, d := t.In(eastern).Date()
		return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	}
	type acc struct{ sum, n float64 }
	byDay := map[time.Time]*acc{}
	var sleep float64
	out := &MoodSummary{From: day(now.Add(-moodWindow)), To: day(now), Days: []MoodDay{}}
	for _, r := range rows {
		if r.OwnerMemberID != viewer {
			continue // the partner's shared check-ins are theirs to send
		}
		d := day(r.RecordedAt)
		if byDay[d] == nil {
			byDay[d] = &acc{}
		}
		byDay[d].sum += float64(r.Mood)
		byDay[d].n++
		sleep += r.SleepHours
		out.Checkins++
	}
	for d, a := range byDay {
		m := math.Round(a.sum/a.n*10) / 10
		out.Days = append(out.Days, MoodDay{Day: d, Mood: m})
		if m <= lowScore {
			out.LowDays++
		}
	}
	sort.Slice(out.Days, func(i, j int) bool { return out.Days[i].Day.Before(out.Days[j].Day) })
	if out.Checkins > 0 {
		avg := math.Round(sleep/float64(out.Checkins)*10) / 10
		out.AverageSleep = &avg
	}
	return out, nil
}

// MoveBooking moves the parent's own upcoming session to another open slot.
// A brief waiting to be sent moves with it.
func MoveBooking(ctx context.Context, pool *pgxpool.Pool, familyID, actor, bookingID, slotID uuid.UUID, now time.Time) (Booking, error) {
	var out Booking
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if b := findBooking(ctx, q, familyID, actor, bookingID); b == nil || !b.StartsAt.After(now) {
			return ErrNoBooking
		}
		_, err := q.MoveOwnPsychologistBookingVisibleToParent(ctx, store.MoveOwnPsychologistBookingVisibleToParentParams{
			ID: bookingID, FamilyID: familyID, OwnerMemberID: actor, Now: now, SlotID: slotID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSlotTaken
		}
		if err != nil {
			return err
		}
		b := findBooking(ctx, q, familyID, actor, bookingID)
		if b == nil {
			return ErrNoBooking
		}
		out = *b
		at := b.StartsAt.Add(-SendAhead)
		if at.Before(now) {
			at = now
		}
		if err := q.MoveScheduledSessionBriefs(ctx, store.MoveScheduledSessionBriefsParams{
			SendAt: pgtype.Timestamptz{Time: at, Valid: true}, Now: now, FamilyID: familyID, OwnerMemberID: actor,
			BookingID: uuid.NullUUID{UUID: bookingID, Valid: true},
		}); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityBooking, bookingID.String())
	})
	return out, err
}

// CancelBooking cancels the parent's own upcoming session. A brief waiting to
// be sent goes back to a draft, so nothing is sent for it.
func CancelBooking(ctx context.Context, pool *pgxpool.Pool, familyID, actor, bookingID uuid.UUID, now time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := q.UnscheduleSessionBriefs(ctx, store.UnscheduleSessionBriefsParams{
			Now: now, FamilyID: familyID, OwnerMemberID: actor, BookingID: uuid.NullUUID{UUID: bookingID, Valid: true},
		}); err != nil {
			return err
		}
		n, err := q.DeleteOwnUpcomingPsychologistBooking(ctx, store.DeleteOwnUpcomingPsychologistBookingParams{
			ID: bookingID, FamilyID: familyID, OwnerMemberID: actor, Now: now,
		})
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNoBooking
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entityBooking, bookingID.String())
	})
}
