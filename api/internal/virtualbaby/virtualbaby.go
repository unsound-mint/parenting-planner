// Package virtualbaby runs the Virtual Baby practice: a simulated newborn whose
// moments (hungry, wet, sleepy, fussy) arrive on a simulated clock, and the
// parents' answers with kind, sourced feedback. Sessions belong to the family:
// both parents see every session and who handled each moment, which is the
// point (practising sharing the load). Caregivers never reach it (the handlers
// are parents only). Nothing here is health data about a real person.
//
// The simulated clock is not stored: the web app runs it only while the page
// is open, and a moment's simulated minute comes from the fixed schedule, so
// nothing is ever pushed in real time and nobody is woken at night.
package virtualbaby

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrActive         = errors.New("a session is already active")
	ErrNoSession      = errors.New("no such session")
	ErrTaken          = errors.New("moment already handled or session finished")
	ErrUnknownChoice  = errors.New("unknown choice")
	ErrUnknownMode    = errors.New("unknown mode")
	errScheduleBroken = errors.New("schedule names an unknown scenario")
)

type Mode string

const (
	Evening   Mode = "evening"
	Challenge Mode = "challenge"
)

// Slot is one scheduled moment: Minute simulated minutes after the start.
type Slot struct {
	Minute   int
	Scenario string
}

// Plan is a mode's fixed shape. The same schedule for every family keeps the
// practice comparable between partners and the tests simple.
type Plan struct {
	StartClock int // minutes after midnight
	Length     int // simulated minutes
	Slots      []Slot
}

var plans = map[Mode]Plan{
	// 18:00 to midnight.
	Evening: {StartClock: 18 * 60, Length: 6 * 60, Slots: []Slot{
		{20, "early-cues"}, {60, "after-feed"}, {110, "checked-all"}, {160, "on-her-back"}, {250, "turns-away"}, {330, "sofa-doze"},
	}},
	// 08:00 on day one to 08:00 two days later: two days and two nights.
	Challenge: {StartClock: 8 * 60, Length: 48 * 60, Slots: []Slot{
		{30, "early-cues"}, {75, "wipes-away"}, {150, "on-her-back"}, {240, "turns-away"}, {280, "poo-change"},
		{370, "car-seat"}, {450, "early-cues"}, {570, "checked-all"}, {660, "at-limit"}, {750, "cosy-crib"},
		{840, "too-warm"}, {910, "after-feed"}, {1120, "night-feed"}, {1290, "sofa-doze"},
		{1450, "early-cues"}, {1540, "poo-change"}, {1650, "wipes-away"}, {1740, "turns-away"}, {1860, "checked-all"},
		{2010, "car-seat"}, {2130, "at-limit"}, {2220, "on-her-back"}, {2490, "night-feed"}, {2640, "after-feed"}, {2850, "early-cues"},
	}},
}

// PlanFor returns the fixed plan of a mode.
func PlanFor(m Mode) (Plan, bool) {
	p, ok := plans[m]
	return p, ok
}

// Moment is a handled moment with its scenario and feedback resolved.
type Moment struct {
	Seq       int
	Minute    int
	Scenario  Scenario
	Choice    Choice
	HandledBy uuid.UUID
	HandledAt time.Time
}

// Prompt is the moment the baby is waiting on.
type Prompt struct {
	Seq      int
	Minute   int
	Scenario Scenario
}

type NeedClock struct {
	Need  Need
	Since int
	Every int
}

type Count struct {
	MemberID uuid.UUID
	Count    int
}

type Practised struct {
	Need     Need
	ByMember []Count
}

type Session struct {
	ID         uuid.UUID
	Mode       Mode
	StartedAt  time.Time
	StartedBy  uuid.UUID
	FinishedAt *time.Time
	Plan       Plan
	Moments    []Moment
	Next       *Prompt
	Needs      []NeedClock
	Practised  []Practised
}

// build resolves a stored session and its moments into the view the API returns.
func build(row store.VirtualBabySession, rows []store.VirtualBabyMoment) (Session, error) {
	plan := plans[Mode(row.Mode)]
	s := Session{ID: row.ID, Mode: Mode(row.Mode), StartedAt: row.StartedAt, StartedBy: row.StartedBy, Plan: plan, Moments: []Moment{}}
	if row.FinishedAt.Valid {
		t := row.FinishedAt.Time
		s.FinishedAt = &t
	}
	for _, r := range rows {
		seq := int(r.Seq)
		if seq >= len(plan.Slots) {
			continue
		}
		sc, ok := Lookup(r.ScenarioID)
		if !ok {
			return Session{}, errScheduleBroken
		}
		ch, ok := sc.Choice(r.ChoiceID)
		if !ok {
			return Session{}, errScheduleBroken
		}
		s.Moments = append(s.Moments, Moment{Seq: seq, Minute: plan.Slots[seq].Minute, Scenario: sc, Choice: ch, HandledBy: r.HandledBy, HandledAt: r.HandledAt})
	}
	if s.FinishedAt == nil && len(s.Moments) < len(plan.Slots) {
		slot := plan.Slots[len(s.Moments)]
		sc, ok := Lookup(slot.Scenario)
		if !ok {
			return Session{}, errScheduleBroken
		}
		s.Next = &Prompt{Seq: len(s.Moments), Minute: slot.Minute, Scenario: sc}
	}
	s.Needs = needClocks(s.Moments)
	s.Practised = practised(s.Moments)
	return s, nil
}

// needClocks says when each need was last cared for. Before the first moment
// the needs start part-way full (a baby is never at zero), staggered so the
// meters do not move in lockstep.
func needClocks(ms []Moment) []NeedClock {
	start := map[Need]int{Hungry: -150, Wet: -90, Sleepy: -60, Fussy: -60}
	out := make([]NeedClock, 0, len(Needs))
	for _, n := range Needs {
		since := start[n]
		for _, m := range ms {
			if m.Scenario.Need == n {
				since = m.Minute
			}
		}
		out = append(out, NeedClock{Need: n, Since: since, Every: Every[n]})
	}
	return out
}

func practised(ms []Moment) []Practised {
	out := []Practised{}
	for _, n := range Needs {
		var counts []Count
		for _, m := range ms {
			if m.Scenario.Need != n {
				continue
			}
			found := false
			for i := range counts {
				if counts[i].MemberID == m.HandledBy {
					counts[i].Count++
					found = true
				}
			}
			if !found {
				counts = append(counts, Count{MemberID: m.HandledBy, Count: 1})
			}
		}
		if len(counts) > 0 {
			out = append(out, Practised{Need: n, ByMember: counts})
		}
	}
	return out
}

const (
	// ListLimit is how many sessions the screen shows.
	ListLimit = 10
	// stickerWindow is how many sessions count towards stickers.
	stickerWindow = 200
)

// List returns the family's sessions, newest first with the active one first,
// and the stickers earned across them.
func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) ([]Session, []Sticker, error) {
	q := store.New(pool)
	rows, err := q.ListVirtualBabySessions(ctx, store.ListVirtualBabySessionsParams{FamilyID: familyID, MaxRows: stickerWindow})
	if err != nil {
		return nil, nil, err
	}
	sessions, err := withMoments(ctx, q, familyID, rows)
	if err != nil {
		return nil, nil, err
	}
	stickers := Stickers(sessions)
	if len(sessions) > ListLimit {
		sessions = sessions[:ListLimit]
	}
	return sessions, stickers, nil
}

func withMoments(ctx context.Context, q *store.Queries, familyID uuid.UUID, rows []store.VirtualBabySession) ([]Session, error) {
	ids := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ID)
	}
	moments, err := q.ListVirtualBabyMoments(ctx, store.ListVirtualBabyMomentsParams{FamilyID: familyID, SessionIds: ids})
	if err != nil {
		return nil, err
	}
	bySession := map[uuid.UUID][]store.VirtualBabyMoment{}
	for _, m := range moments {
		bySession[m.SessionID] = append(bySession[m.SessionID], m)
	}
	out := make([]Session, 0, len(rows))
	for _, r := range rows {
		s, err := build(r, bySession[r.ID])
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}

// Start opens a new session. ErrActive while another one is not finished.
func Start(ctx context.Context, pool *pgxpool.Pool, familyID, member uuid.UUID, mode Mode, now time.Time) (Session, error) {
	if _, ok := plans[mode]; !ok {
		return Session{}, ErrUnknownMode
	}
	row, err := store.New(pool).CreateVirtualBabySession(ctx, store.CreateVirtualBabySessionParams{
		FamilyID: familyID, Mode: string(mode), StartedBy: member, StartedAt: now,
	})
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return Session{}, ErrActive
	}
	if err != nil {
		return Session{}, err
	}
	return build(row, nil)
}

// Respond records member's answer to moment seq. The session row is locked so
// two parents answering at once cannot both win; the loser gets ErrTaken.
// The last moment finishes the session.
func Respond(ctx context.Context, pool *pgxpool.Pool, familyID, sessionID, member uuid.UUID, seq int, choiceID string, now time.Time) (Moment, Session, error) {
	var out Session
	var moment Moment
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.GetVirtualBabySessionForUpdate(ctx, store.GetVirtualBabySessionForUpdateParams{ID: sessionID, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoSession
		}
		if err != nil {
			return err
		}
		sessions, err := withMoments(ctx, q, familyID, []store.VirtualBabySession{row})
		if err != nil {
			return err
		}
		s := sessions[0]
		if s.Next == nil || s.Next.Seq != seq {
			return ErrTaken
		}
		choice, ok := s.Next.Scenario.Choice(choiceID)
		if !ok {
			return ErrUnknownChoice
		}
		n, err := q.CreateVirtualBabyMoment(ctx, store.CreateVirtualBabyMomentParams{
			SessionID: sessionID, FamilyID: familyID, Seq: int32(seq), ScenarioID: s.Next.Scenario.ID,
			ChoiceID: choice.ID, HandledBy: member, HandledAt: now,
		})
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrTaken
		}
		if seq == len(s.Plan.Slots)-1 {
			if row, err = q.FinishVirtualBabySession(ctx, store.FinishVirtualBabySessionParams{ID: sessionID, FamilyID: familyID, FinishedAt: pgtype.Timestamptz{Time: now, Valid: true}}); err != nil {
				return err
			}
		}
		sessions, err = withMoments(ctx, q, familyID, []store.VirtualBabySession{row})
		if err != nil {
			return err
		}
		out = sessions[0]
		moment = out.Moments[len(out.Moments)-1]
		return nil
	})
	return moment, out, err
}

// Finish ends a session early. Finishing a finished session returns it as is.
func Finish(ctx context.Context, pool *pgxpool.Pool, familyID, sessionID uuid.UUID, now time.Time) (Session, error) {
	var out Session
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.GetVirtualBabySessionForUpdate(ctx, store.GetVirtualBabySessionForUpdateParams{ID: sessionID, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoSession
		}
		if err != nil {
			return err
		}
		if !row.FinishedAt.Valid {
			if row, err = q.FinishVirtualBabySession(ctx, store.FinishVirtualBabySessionParams{ID: sessionID, FamilyID: familyID, FinishedAt: pgtype.Timestamptz{Time: now, Valid: true}}); err != nil {
				return err
			}
		}
		sessions, err := withMoments(ctx, q, familyID, []store.VirtualBabySession{row})
		if err != nil {
			return err
		}
		out = sessions[0]
		return nil
	})
	return out, err
}

// Seeded is one answered moment for a demo seed: the slot index and who answered.
type Seeded struct {
	Choice    string
	HandledBy uuid.UUID
}

// Seed stores a finished session with answers for a demo family, as if it was
// played at startedAt, one real minute per moment.
func Seed(ctx context.Context, q *store.Queries, familyID uuid.UUID, mode Mode, startedBy uuid.UUID, startedAt time.Time, answers []Seeded) error {
	plan := plans[mode]
	finished := startedAt.Add(time.Duration(len(answers)+1) * time.Minute)
	row, err := q.CreateVirtualBabySession(ctx, store.CreateVirtualBabySessionParams{
		FamilyID: familyID, Mode: string(mode), StartedBy: startedBy, StartedAt: startedAt,
		FinishedAt: pgtype.Timestamptz{Time: finished, Valid: true},
	})
	if err != nil {
		return err
	}
	for i, a := range answers {
		if i >= len(plan.Slots) {
			break
		}
		if _, err := q.CreateVirtualBabyMoment(ctx, store.CreateVirtualBabyMomentParams{
			SessionID: row.ID, FamilyID: familyID, Seq: int32(i), ScenarioID: plan.Slots[i].Scenario,
			ChoiceID: a.Choice, HandledBy: a.HandledBy, HandledAt: startedAt.Add(time.Duration(i+1) * time.Minute),
		}); err != nil {
			return err
		}
	}
	return nil
}
