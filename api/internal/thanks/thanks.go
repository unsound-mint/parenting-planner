// Package thanks writes the thank-you notes between parents (and to
// caregivers). Suggestions are built from data both parents already see: the
// care log, tasks and shifts. Never from diary, mood or any private record.
package thanks

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/loadmap"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrNotParent = errors.New("only a parent can send a thank-you note")
	ErrToSelf    = errors.New("a thank-you note goes to someone else")
	ErrNoTarget  = errors.New("the note goes to the other parent or a caregiver of the family")
	ErrDuplicate = errors.New("this has been thanked already")
	ErrEmpty     = errors.New("a thank-you note needs some words")
)

// Window is how far back notes are listed and how far back a suggestion looks.
const (
	Window        = 30 * 24 * time.Hour
	SuggestedDays = 7
	maxSuggested  = 6
)

func IsParent(role string) bool { return role == "mother" || role == "partner" }

// Suggestion mirrors ThanksSuggestion.
type Suggestion struct {
	Key      string
	ToMember uuid.UUID
	Basis    string
	Count    int
	On       time.Time
	Text     string
}

type Input struct {
	Now    time.Time
	Actor  uuid.UUID
	People []store.Member // everyone in the family, the actor included
	Care   []store.CareLogEntry
	Tasks  []store.Task
	Shifts []store.Shift
	Sent   map[string]bool // keys that already have a note
}

func day(t time.Time) time.Time { return t.UTC().Truncate(24 * time.Hour) }

func weekday(d time.Time) string { return d.Weekday().String() }

func plural(n int, one, many string) string {
	if n == 1 {
		return "the " + one
	}
	return fmt.Sprintf("the %d %s", n, many)
}

// Key names one thing that was thanked: what it was, who did it, on which day.
func Key(basis string, to uuid.UUID, d time.Time) string {
	return basis + ":" + to.String() + ":" + d.Format("2006-01-02")
}

// Suggest words the specific things other people did for the actor in the last
// week. Each person gets at most one suggestion per basis, for the most recent
// day that qualifies. Suggestions that already have a note are left out.
func Suggest(in Input) []Suggestion {
	since := in.Now.AddDate(0, 0, -SuggestedDays)
	var out []Suggestion
	add := func(s Suggestion) {
		if !in.Sent[s.Key] {
			out = append(out, s)
		}
	}
	for _, p := range in.People {
		if p.ID == in.Actor {
			continue
		}
		parent := IsParent(p.Role)
		name := p.DisplayName

		// Care entries by this person, per day. A night belongs to the day it started.
		type dayCount struct{ nightFeeds, feeds, diapers, all int }
		days := map[time.Time]*dayCount{}
		for _, e := range in.Care {
			if e.AuthorMemberID != p.ID || e.Kind == "sleep" || e.StartedAt.Before(since) || e.StartedAt.After(in.Now) {
				continue
			}
			d := day(e.StartedAt)
			if loadmap.IsNight(e.StartedAt) && e.StartedAt.UTC().Hour() < 6 {
				d = d.AddDate(0, 0, -1)
			}
			c := days[d]
			if c == nil {
				c = &dayCount{}
				days[d] = c
			}
			c.all++
			switch {
			case e.Kind == "feed" && loadmap.IsNight(e.StartedAt):
				c.nightFeeds++
			case e.Kind == "feed":
				c.feeds++
			case e.Kind == "diaper" && !loadmap.IsNight(e.StartedAt):
				c.diapers++
			}
		}
		ds := make([]time.Time, 0, len(days))
		for d := range days {
			ds = append(ds, d)
		}
		sort.Slice(ds, func(i, j int) bool { return ds[i].After(ds[j]) })
		pick := func(ok func(*dayCount) bool) (time.Time, *dayCount) {
			for _, d := range ds {
				if ok(days[d]) {
					return d, days[d]
				}
			}
			return time.Time{}, nil
		}

		if parent {
			if d, c := pick(func(c *dayCount) bool { return c.nightFeeds > 0 }); c != nil {
				add(Suggestion{Key("night_feeds", p.ID, d), p.ID, "night_feeds", c.nightFeeds, d,
					fmt.Sprintf("Thank you for %s on %s.", plural(c.nightFeeds, "night feed", "night feeds"), weekday(d))})
			}
			if d, c := pick(func(c *dayCount) bool { return c.feeds >= 3 }); c != nil {
				add(Suggestion{Key("feeds", p.ID, d), p.ID, "feeds", c.feeds, d,
					fmt.Sprintf("Thank you for %d feeds on %s.", c.feeds, weekday(d))})
			}
			if d, c := pick(func(c *dayCount) bool { return c.diapers >= 3 }); c != nil {
				add(Suggestion{Key("diaper_changes", p.ID, d), p.ID, "diaper_changes", c.diapers, d,
					fmt.Sprintf("Thank you for %d diaper changes on %s.", c.diapers, weekday(d))})
			}

			var bag, other []store.Task
			for _, t := range in.Tasks {
				if !t.Done || !t.DoneByMemberID.Valid || t.DoneByMemberID.UUID != p.ID || !t.DoneAt.Valid || t.DoneAt.Time.Before(since) {
					continue
				}
				if t.Kind == "hospital_bag" {
					bag = append(bag, t)
				} else {
					other = append(other, t)
				}
			}
			if len(bag) > 0 {
				d := latestDone(bag)
				txt := "Thank you for packing the bag item."
				if len(bag) > 1 {
					txt = fmt.Sprintf("Thank you for packing %d bag items.", len(bag))
				}
				add(Suggestion{Key("bag_items", p.ID, d), p.ID, "bag_items", len(bag), d, txt})
			}
			if len(other) > 0 {
				d := latestDone(other)
				txt := fmt.Sprintf("Thank you for getting \u201c%s\u201d done.", other[0].Title)
				if len(other) > 1 {
					txt = fmt.Sprintf("Thank you for getting %d things off our list.", len(other))
				}
				add(Suggestion{Key("tasks_done", p.ID, d), p.ID, "tasks_done", len(other), d, txt})
			}
			continue
		}

		// A caregiver: the most recent day of care, else the most recent shift day.
		if d, c := pick(func(c *dayCount) bool { return c.all > 0 }); c != nil {
			feeds := c.feeds + c.nightFeeds
			txt := fmt.Sprintf("Thank you, %s, for looking after the baby on %s.", name, weekday(d))
			if feeds > 0 {
				txt = fmt.Sprintf("Thank you, %s, for %s on %s.", name, plural(feeds, "feed", "feeds"), weekday(d))
			}
			add(Suggestion{Key("caregiver_care", p.ID, d), p.ID, "caregiver_care", c.all, d, txt})
			continue
		}
		if d, title, ok := lastShiftDay(in.Shifts, p.ID, in.Now); ok {
			add(Suggestion{Key("caregiver_shift", p.ID, d), p.ID, "caregiver_shift", 1, d,
				fmt.Sprintf("Thank you, %s, for %s’s %s.", name, weekday(d), strings.ToLower(title))})
		}
	}
	// Newest thing first, then by key so the order is stable.
	sort.SliceStable(out, func(i, j int) bool {
		if !out[i].On.Equal(out[j].On) {
			return out[i].On.After(out[j].On)
		}
		return out[i].Key < out[j].Key
	})
	if len(out) > maxSuggested {
		out = out[:maxSuggested]
	}
	return out
}

func latestDone(ts []store.Task) time.Time {
	var latest time.Time
	for _, t := range ts {
		if t.DoneAt.Time.After(latest) {
			latest = t.DoneAt.Time
		}
	}
	return day(latest)
}

var weekdayKeys = [...]string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}

// lastShiftDay is the most recent day before today, within the last week, on
// which one of the member's active shifts was due.
func lastShiftDay(shifts []store.Shift, member uuid.UUID, now time.Time) (time.Time, string, bool) {
	for back := 1; back <= SuggestedDays; back++ {
		d := day(now).AddDate(0, 0, -back)
		for _, s := range shifts {
			if s.MemberID != member || s.Status != "active" || (s.StartsOn != nil && s.StartsOn.After(d)) {
				continue
			}
			if slices.Contains(s.Days, weekdayKeys[d.Weekday()]) {
				return d, s.Title, true
			}
		}
	}
	return time.Time{}, "", false
}

// Suggestions loads the data and words the suggestions for a parent.
func Suggestions(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, actor store.Member, now time.Time) ([]Suggestion, error) {
	if !IsParent(actor.Role) {
		return nil, ErrNotParent
	}
	q := store.New(pool)
	parents, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	caregivers, err := q.ListCaregivers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	care, err := q.ListCareLogEntries(ctx, store.ListCareLogEntriesParams{FamilyID: familyID, Since: now.AddDate(0, 0, -SuggestedDays-1)})
	if err != nil {
		return nil, err
	}
	taskRows, err := q.ListTasks(ctx, store.ListTasksParams{FamilyID: familyID})
	if err != nil {
		return nil, err
	}
	shifts, err := q.ListActiveShifts(ctx, familyID)
	if err != nil {
		return nil, err
	}
	keys, err := q.ListThanksKeys(ctx, familyID)
	if err != nil {
		return nil, err
	}
	sent := map[string]bool{}
	for _, k := range keys {
		if k != nil {
			sent[*k] = true
		}
	}
	return Suggest(Input{Now: now, Actor: actor.ID, People: append(parents, caregivers...), Care: care, Tasks: taskRows, Shifts: shifts, Sent: sent}), nil
}

// Send stores a note from a parent to the other parent or to a caregiver.
func Send(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, from store.Member, to uuid.UUID, body string, key *string, now time.Time) (store.Thank, error) {
	if !IsParent(from.Role) {
		return store.Thank{}, ErrNotParent
	}
	if to == from.ID {
		return store.Thank{}, ErrToSelf
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return store.Thank{}, ErrEmpty
	}
	var out store.Thank
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.GetPerson(ctx, store.GetPersonParams{ID: to, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
			return ErrNoTarget
		} else if err != nil {
			return err
		}
		var err error
		out, err = q.CreateThanks(ctx, store.CreateThanksParams{FamilyID: familyID, FromMemberID: from.ID, ToMemberID: to, Body: body, SuggestionKey: key, CreatedAt: now})
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "23505" {
			return ErrDuplicate
		}
		return err
	})
	return out, err
}

// List returns the notes of the last 30 days: all of them for a parent, only
// the ones addressed to them for a caregiver.
func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, viewer store.Member, now time.Time) ([]store.Thank, error) {
	q := store.New(pool)
	since := now.Add(-Window)
	if IsParent(viewer.Role) {
		return q.ListThanks(ctx, store.ListThanksParams{FamilyID: familyID, Since: since})
	}
	return q.ListThanksToMember(ctx, store.ListThanksToMemberParams{FamilyID: familyID, ToMemberID: viewer.ID, Since: since})
}

// Seed stores a note for a demo family at the given time.
func Seed(ctx context.Context, q *store.Queries, familyID, from, to uuid.UUID, body, key string, at time.Time) error {
	_, err := q.CreateThanks(ctx, store.CreateThanksParams{FamilyID: familyID, FromMemberID: from, ToMemberID: to, Body: body, SuggestionKey: &key, CreatedAt: at})
	return err
}
