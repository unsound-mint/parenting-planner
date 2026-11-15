// Package shifts holds the recurring care shifts people commit to. The pure
// functions here (overlap, occurrences) have table tests; Create and List run
// against the store.
package shifts

import (
	"context"
	"errors"
	"sort"
	"time"
	_ "time/tzdata" // the API image may have no zoneinfo

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrOverlap  = errors.New("overlaps one of your own shifts")
	ErrSameTime = errors.New("start and end are the same time")
)

var weekdays = [...]string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"} // time.Weekday order

// Weekday is the contract name of a date's weekday.
func Weekday(t time.Time) string { return weekdays[t.Weekday()] }

const (
	day  = 24 * 60
	week = 7 * day
)

func weekdayIndex(name string) int { // mon = 0
	for i, n := range [...]string{"mon", "tue", "wed", "thu", "fri", "sat", "sun"} {
		if n == name {
			return i
		}
	}
	return -1
}

func minutes(hhmm string) int {
	return int(hhmm[0]-'0')*600 + int(hhmm[1]-'0')*60 + int(hhmm[3]-'0')*10 + int(hhmm[4]-'0')
}

// Spec is the recurring part of a shift.
type Spec struct {
	Days       []string
	Start, End string
}

// intervals returns the shift's occurrences as minute ranges from Monday 00:00.
// An end at or before the start runs into the next morning.
func (s Spec) intervals() [][2]int {
	start, end := minutes(s.Start), minutes(s.End)
	if end <= start {
		end += day
	}
	var out [][2]int
	for _, d := range s.Days {
		base := weekdayIndex(d) * day
		out = append(out, [2]int{base + start, base + end})
	}
	return out
}

// Overlap reports whether two shifts are ever on duty at the same time in a
// repeating week, including a night shift that runs into the next day and the
// wrap from Sunday night to Monday morning.
func Overlap(a, b Spec) bool {
	for _, x := range a.intervals() {
		for _, y := range b.intervals() {
			for _, off := range [...]int{-week, 0, week} {
				if x[0] < y[1]+off && y[0]+off < x[1] {
					return true
				}
			}
		}
	}
	return false
}

// Occurrence is one run of a shift on a calendar day.
type Occurrence struct {
	Date       time.Time // the day it starts
	Start, End time.Time
}

// familyZone is the zone the web formats every time in (web/src/lib/format.ts).
// A shift's "22:00" is 22:00 on the family's clock, not 22:00 UTC (5 PM on screen).
var familyZone = func() *time.Location {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		return time.FixedZone("EST", -5*60*60)
	}
	return loc
}()

// at is hhmm on date's calendar day, on the family's clock. Only date's Y/M/D is used.
func at(date time.Time, hhmm string) time.Time {
	m := minutes(hhmm)
	return time.Date(date.Year(), date.Month(), date.Day(), m/60, m%60, 0, 0, familyZone)
}

// Occurrences lists the runs of an active shift that start in [from, to), not
// before its start day.
func Occurrences(sh store.Shift, from, to time.Time) []Occurrence {
	var out []Occurrence
	if sh.StartsOn == nil {
		return out
	}
	for d := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC); d.Before(to); d = d.AddDate(0, 0, 1) {
		if d.Before(*sh.StartsOn) || !contains(sh.Days, Weekday(d)) {
			continue
		}
		s, e := at(d, sh.StartTime), at(d, sh.EndTime)
		if !e.After(s) {
			e = e.AddDate(0, 0, 1)
		}
		out = append(out, Occurrence{Date: d, Start: s, End: e})
	}
	return out
}

// Current returns the run of an active shift that covers now, if any.
func Current(sh store.Shift, now time.Time) (Occurrence, bool) {
	for _, o := range Occurrences(sh, now.AddDate(0, 0, -1), now.AddDate(0, 0, 1)) {
		if !now.Before(o.Start) && now.Before(o.End) {
			return o, true
		}
	}
	return Occurrence{}, false
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// New is a shift to commit to.
type New struct {
	Title      string
	Days       []string
	Start, End string
	RoundID    *uuid.UUID
}

// Create stores a shift for a person: agreed before the baby is home, active
// from today after. It refuses a shift that overlaps one of the person's own.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, memberID uuid.UUID, in New, today, now time.Time) (store.Shift, error) {
	if in.Start == in.End {
		return store.Shift{}, ErrSameTime
	}
	q := store.New(pool)
	own, err := q.ListShiftsOfMember(ctx, store.ListShiftsOfMemberParams{FamilyID: familyID, MemberID: memberID})
	if err != nil {
		return store.Shift{}, err
	}
	spec := Spec{Days: in.Days, Start: in.Start, End: in.End}
	for _, s := range own {
		if Overlap(spec, Spec{Days: s.Days, Start: s.StartTime, End: s.EndTime}) {
			return store.Shift{}, ErrOverlap
		}
	}
	children, err := q.ListChildren(ctx, familyID)
	if err != nil {
		return store.Shift{}, err
	}
	status, startsOn := "agreed", (*time.Time)(nil)
	if len(children) > 0 {
		status, startsOn = "active", &today
	}
	var round uuid.NullUUID
	if in.RoundID != nil {
		round = uuid.NullUUID{UUID: *in.RoundID, Valid: true}
	}
	var created store.Shift
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		tq := store.New(tx)
		var err error
		created, err = tq.CreateShift(ctx, store.CreateShiftParams{
			FamilyID: familyID, MemberID: memberID, Title: in.Title, Days: in.Days, StartTime: in.Start, EndTime: in.End,
			Status: status, StartsOn: startsOn, RoundID: round,
		})
		if err != nil {
			return err
		}
		// The parents and the person on the shift are told.
		audience, err := live.ParentsAnd(ctx, tq, familyID, memberID)
		if err != nil {
			return err
		}
		return live.Publish(ctx, tq, familyID, live.Event{Kind: live.Shift, EntityID: created.ID.String(), Actor: memberID, Audience: audience}, now)
	})
	return created, err
}

// List returns shifts ordered by first weekday, then start time. Everyone's for
// a parent, only their own for a caregiver (onlyMember).
func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, onlyMember *uuid.UUID) ([]store.Shift, error) {
	all, err := store.New(pool).ListShifts(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var out []store.Shift
	for _, s := range all {
		if onlyMember == nil || s.MemberID == *onlyMember {
			out = append(out, s)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := firstDay(out[i].Days), firstDay(out[j].Days)
		if a != b {
			return a < b
		}
		return out[i].StartTime < out[j].StartTime
	})
	return out, nil
}

func firstDay(days []string) int {
	first := 7
	for _, d := range days {
		if i := weekdayIndex(d); i < first {
			first = i
		}
	}
	return first
}
