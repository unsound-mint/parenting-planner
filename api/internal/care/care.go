// Package care owns the psychologist flow: the agenda for the next session,
// open slots with the demo psychologist, bookings and the note after a session.
//
// Built like internal/wellbeing: functions take the store, the family id and
// the acting member id; every read and write of a booking, a session note or
// a mood check-in runs in one transaction together with access.Audit; reads
// use the *VisibleToParent SQL and then keep only the acting parent's own
// rows, because bookings, notes and the agenda belong to that parent alone.
package care

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	entityBooking     = "psychologist_booking"
	entitySessionNote = "session_note"
	entityMoodCheckin = "mood_checkin"
	entityDiaryEntry  = "diary_entry"
)

const (
	// SlotWindow is how far ahead open slots are listed.
	SlotWindow = 14 * 24 * time.Hour
	// moodWindow is how far back the agenda looks at the parent's check-ins.
	moodWindow = 14 * 24 * time.Hour
	// noteWindow is how far back the agenda looks for the last session note.
	noteWindow = 30 * 24 * time.Hour
)

// Thresholds for turning the parent's own check-ins into agenda topics. They
// describe what the parent logged; they never assess it.
const (
	lowScore      = 2 // mood or energy at or below this counts as a low day
	minLowDays    = 2 // this many low days make a topic
	shortSleep    = 6.0
	minSleepCount = 3 // average sleep over at least this many check-ins
)

var (
	ErrSlotTaken  = errors.New("slot taken")
	ErrNoBooking  = errors.New("no such booking")
	ErrNotStarted = errors.New("session has not started")
	ErrNoteExists = errors.New("session note already written")
)

// Booking is a booking with its slot time and provider.
type Booking struct {
	ID              uuid.UUID
	Psychologist    store.Psychologist
	StartsAt        time.Time
	DurationMinutes int
	NoteWritten     bool
}

// Topic is one line on the agenda. Its id is stable for the same parent and
// topic so the UI can key on it.
type Topic struct {
	ID      uuid.UUID
	Text    string
	AddedAt time.Time
	// DiaryEntryID is set when the topic came from one of the parent's own
	// diary entries, so the UI can link back to the (still private) entry.
	DiaryEntryID uuid.NullUUID
}

type Agenda struct {
	Topics      []Topic // oldest first
	NextSession *Booking
	NoteDue     *Booking
	Suggestions []Suggestion
}

// GetAgenda builds the acting parent's agenda from their own data only: their
// own mood check-ins and their own bookings and notes. Private text (check-in
// notes, session notes) never becomes a topic.
func GetAgenda(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, viewer uuid.UUID, now time.Time) (Agenda, error) {
	var out Agenda
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		if out, err = buildAgenda(ctx, q, familyID, viewer, now); err != nil {
			return err
		}
		if out.Suggestions, err = suggestions(ctx, q, key, familyID, viewer, now, out.Topics); err != nil {
			return err
		}
		for _, e := range []string{entityBooking, entitySessionNote, entityMoodCheckin, entityDiaryEntry} {
			if err := access.Audit(ctx, q, familyID, viewer, access.ActionRead, e, ""); err != nil {
				return err
			}
		}
		return nil
	})
	return out, err
}

// buildAgenda reads the parent's own data and applies their saved arrangement.
// It does not audit: callers do, once for their own purpose.
func buildAgenda(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, now time.Time) (Agenda, error) {
	var out Agenda
	bookings, err := OwnBookings(ctx, q, familyID, viewer)
	if err != nil {
		return out, err
	}
	moods, err := q.ListMoodCheckinsVisibleToParent(ctx, store.ListMoodCheckinsVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer, Since: now.Add(-moodWindow),
	})
	if err != nil {
		return out, err
	}
	notes, err := q.ListSessionNotesVisibleToParent(ctx, store.ListSessionNotesVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer, Since: now.Add(-noteWindow),
	})
	if err != nil {
		return out, err
	}
	// bookings are newest first: the last future one is the next session,
	// the first started one without a note is the note that is due.
	for i := range bookings {
		b := bookings[i]
		if b.StartsAt.After(now) {
			out.NextSession = &b
		} else if !b.NoteWritten && out.NoteDue == nil {
			out.NoteDue = &b
		}
	}
	prefs, err := q.ListAgendaTopicPrefs(ctx, store.ListAgendaTopicPrefsParams{FamilyID: familyID, MemberID: viewer})
	if err != nil {
		return out, err
	}
	all := topics(viewer, moods, notes)
	// Topics the parent chose on their own diary entries (never the entry text).
	dt, err := q.ListDiaryAgendaTopicsVisibleToParent(ctx, store.ListDiaryAgendaTopicsVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer, Since: now.Add(-noteWindow),
	})
	if err != nil {
		return out, err
	}
	for _, d := range dt {
		if d.AgendaTopic != nil {
			all = append(all, Topic{
				ID: uuid.NewSHA1(viewer, []byte("diary-"+d.ID.String())), Text: *d.AgendaTopic, AddedAt: d.WrittenAt,
				DiaryEntryID: uuid.NullUUID{UUID: d.ID, Valid: true},
			})
		}
	}
	sort.SliceStable(all, func(i, j int) bool { return all[i].AddedAt.Before(all[j].AddedAt) })
	out.Topics = arrange(all, prefs)
	return out, nil
}

// arrange drops the topics the parent removed and puts the ones they ordered
// first, in their order; topics that are new since they last arranged the
// agenda follow, oldest first.
func arrange(all []Topic, prefs []store.AgendaTopicPref) []Topic {
	pos := map[uuid.UUID]int{}
	removed := map[uuid.UUID]bool{}
	for _, p := range prefs {
		if p.RemovedAt.Valid {
			removed[p.TopicID] = true
		} else if p.Position.Valid {
			pos[p.TopicID] = int(p.Position.Int32)
		}
	}
	var ordered, fresh []Topic
	for _, t := range all { // oldest first
		switch _, saved := pos[t.ID]; {
		case removed[t.ID]:
		case saved:
			ordered = append(ordered, t)
		default:
			fresh = append(fresh, t)
		}
	}
	sort.SliceStable(ordered, func(i, j int) bool { return pos[ordered[i].ID] < pos[ordered[j].ID] })
	return append(ordered, fresh...)
}

// ErrUnknownTopic: an id that is not on the acting parent's current agenda.
var ErrUnknownTopic = errors.New("unknown topic")

const entityAgenda = "psychologist_agenda"

// UpdateAgenda stores the parent's arrangement: topicIDs is the whole agenda in
// the wanted order, a current topic left out is removed (and stays removed), an
// empty list clears the agenda. It returns the agenda as it is afterwards.
func UpdateAgenda(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, viewer uuid.UUID, topicIDs []uuid.UUID, now time.Time) (Agenda, error) {
	var out Agenda
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cur, err := buildAgenda(ctx, q, familyID, viewer, now)
		if err != nil {
			return err
		}
		current := map[uuid.UUID]bool{}
		for _, t := range cur.Topics {
			current[t.ID] = true
		}
		sent := map[uuid.UUID]bool{}
		for _, id := range topicIDs {
			if !current[id] || sent[id] {
				return ErrUnknownTopic
			}
			sent[id] = true
		}
		for i, id := range topicIDs {
			if err := q.UpsertAgendaTopicPosition(ctx, store.UpsertAgendaTopicPositionParams{FamilyID: familyID, MemberID: viewer, TopicID: id, Position: pgtype.Int4{Int32: int32(i), Valid: true}}); err != nil {
				return err
			}
		}
		for _, t := range cur.Topics {
			if !sent[t.ID] {
				if err := q.RemoveAgendaTopic(ctx, store.RemoveAgendaTopicParams{FamilyID: familyID, MemberID: viewer, TopicID: t.ID, RemovedAt: pgtype.Timestamptz{Time: now, Valid: true}}); err != nil {
					return err
				}
			}
		}
		if err := access.Audit(ctx, q, familyID, viewer, access.ActionUpdate, entityAgenda, ""); err != nil {
			return err
		}
		if out, err = buildAgenda(ctx, q, familyID, viewer, now); err != nil {
			return err
		}
		if out.Suggestions, err = suggestions(ctx, q, key, familyID, viewer, now, out.Topics); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityDiaryEntry, "")
	})
	return out, err
}

func topics(viewer uuid.UUID, moods []store.MoodCheckin, notes []store.SessionNote) []Topic {
	var low, tired []time.Time
	var sleepSum float64
	var sleepN int
	var sleepFrom time.Time
	for _, m := range moods {
		if m.OwnerMemberID != viewer {
			continue // the partner's shared check-ins are not this parent's topics
		}
		if m.Mood <= lowScore {
			low = append(low, m.RecordedAt)
		}
		if m.Energy <= lowScore {
			tired = append(tired, m.RecordedAt)
		}
		sleepSum += m.SleepHours
		sleepN++
		sleepFrom = m.RecordedAt // moods are newest first, so this ends on the oldest
	}

	var out []Topic
	add := func(key, text string, at time.Time) {
		out = append(out, Topic{ID: uuid.NewSHA1(viewer, []byte(key)), Text: text, AddedAt: at})
	}
	if len(low) >= minLowDays {
		add("low-days", fmt.Sprintf("What my low days have been like (%d in the last two weeks)", len(low)), low[len(low)-1])
	}
	if len(tired) >= minLowDays {
		add("low-energy", fmt.Sprintf("Running low on energy (%d days in the last two weeks)", len(tired)), tired[len(tired)-1])
	}
	if sleepN >= minSleepCount && sleepSum/float64(sleepN) < shortSleep {
		add("short-sleep", fmt.Sprintf("Sleep: about %.1f hours a night lately", sleepSum/float64(sleepN)), sleepFrom)
	}
	for _, n := range notes {
		if n.OwnerMemberID == viewer {
			add("note-"+n.ID.String(), "Follow up on what I noted after my last session", n.WrittenAt)
			break
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].AddedAt.Before(out[j].AddedAt) })
	return out
}

// ListOpenSlots returns the demo psychologist and the slots in the next two
// weeks that the acting parent has not booked yet.
func ListOpenSlots(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) (store.Psychologist, []store.PsychologistSlot, error) {
	var p store.Psychologist
	var slots []store.PsychologistSlot
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		if p, err = q.GetDemoPsychologist(ctx); err != nil {
			return err
		}
		if slots, err = q.ListOpenSlotsVisibleToParent(ctx, store.ListOpenSlotsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, FromTime: now, ToTime: now.Add(SlotWindow),
		}); err != nil {
			return err
		}
		// The filter reads the parent's bookings, so it is audited like a list.
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityBooking, "")
	})
	return p, slots, err
}

// Book books an open future slot for the acting parent. ErrSlotTaken when the
// slot is unknown, in the past, or already booked by this parent.
func Book(ctx context.Context, pool *pgxpool.Pool, familyID, actor, slotID uuid.UUID, now time.Time) (Booking, error) {
	var out Booking
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		b, err := q.CreatePsychologistBooking(ctx, store.CreatePsychologistBookingParams{
			OwnerMemberID: actor, SlotID: slotID, FamilyID: familyID, Now: now,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSlotTaken
		}
		if err != nil {
			return err
		}
		if err := access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityBooking, b.ID.String()); err != nil {
			return err
		}
		bookings, err := OwnBookings(ctx, q, familyID, actor)
		if err != nil {
			return err
		}
		for _, x := range bookings {
			if x.ID == b.ID {
				out = x
				return nil
			}
		}
		return fmt.Errorf("booking %s not found after insert", b.ID)
	})
	return out, err
}

// WriteNote stores the acting parent's note for one of their own sessions
// that has started. The note is always private.
func WriteNote(ctx context.Context, pool *pgxpool.Pool, familyID, actor, bookingID uuid.UUID, text string, now time.Time) (store.SessionNote, error) {
	var out store.SessionNote
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		bookings, err := OwnBookings(ctx, q, familyID, actor)
		if err != nil {
			return err
		}
		var b *Booking
		for i := range bookings {
			if bookings[i].ID == bookingID {
				b = &bookings[i]
			}
		}
		switch {
		case b == nil:
			return ErrNoBooking
		case b.StartsAt.After(now):
			return ErrNotStarted
		}
		n, err := q.CreateSessionNote(ctx, store.CreateSessionNoteParams{
			FamilyID: familyID, OwnerMemberID: actor, BookingID: bookingID, WrittenAt: now, Text: text,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoteExists
		}
		if err != nil {
			return err
		}
		out = n
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entitySessionNote, n.ID.String())
	})
	return out, err
}

// OwnBookings lists the parent's own bookings, newest first, with providers.
// Callers audit the read.
func OwnBookings(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID) ([]Booking, error) {
	rows, err := q.ListPsychologistBookingsVisibleToParent(ctx, store.ListPsychologistBookingsVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer,
	})
	if err != nil {
		return nil, err
	}
	ps, err := q.ListPsychologists(ctx)
	if err != nil {
		return nil, err
	}
	byID := map[uuid.UUID]store.Psychologist{}
	for _, p := range ps {
		byID[p.ID] = p
	}
	out := []Booking{}
	for _, r := range rows {
		if r.OwnerMemberID != viewer {
			continue // bookings belong to one parent, even if one were ever shared
		}
		out = append(out, Booking{
			ID: r.ID, Psychologist: byID[r.PsychologistID], StartsAt: r.StartsAt,
			DurationMinutes: int(r.DurationMinutes), NoteWritten: r.NoteWritten,
		})
	}
	return out, nil
}
