// Package loadmap answers "who carries what" for the two parents: per area,
// who owns the work now and who created (remembered) it, over the last two
// weeks. It only counts stored data; nothing is entered by hand and nothing
// moves here. Handing an area over is the task reassignment flow.
package loadmap

import (
	"context"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

// WindowDays is how far back the map looks; RecentDays is the "this week" part.
const (
	WindowDays = 14
	RecentDays = 7
)

// Area keys, as in LoadMapAreaKey.
const (
	Appointments = "appointments"
	Shopping     = "shopping"
	Paperwork    = "paperwork"
	HospitalBag  = "hospital_bag"
	Learning     = "learning"
	Planning     = "planning"
	Feeding      = "feeding"
	Diapers      = "diapers"
	Nights       = "nights"
	CareShifts   = "care_shifts"
)

type meta struct{ label, unit string }

var areas = map[string]meta{
	Appointments: {"Appointments", "items"},
	Shopping:     {"Shopping", "items"},
	Paperwork:    {"Paperwork", "items"},
	HospitalBag:  {"Hospital bag", "items"},
	Learning:     {"Learning", "items"},
	Planning:     {"Planning and errands", "items"},
	Feeding:      {"Feeding", "feeds"},
	Diapers:      {"Diapers", "changes"},
	Nights:       {"Nights", "entries"},
	CareShifts:   {"Care shifts", "hours"},
}

// Keywords tell the areas of a free task apart by its title. A fixed list on
// purpose: it is explainable, and anything it misses lands in Planning.
var (
	appointmentRe = regexp.MustCompile(`\b(appointments?|visits?|doctor|pediatrician|midwife|clinic|check-?ups?|dentist|ultrasound|scan|screening|vaccin\w*)\b`)
	paperworkRe   = regexp.MustCompile(`\b(insur\w*|forms?|register|registration|certificate|paperwork|passport|enroll\w*)\b`)
	learningRe    = regexp.MustCompile(`\b(class|classes|course|lesson|workshop|read|tour)\b`)
	shoppingRe    = regexp.MustCompile(`\b(buy|shop|shopping|order|purchase|stock)\b`)
)

// AreaOfTask puts a task in an area: by kind for bag and paperwork, by title otherwise.
func AreaOfTask(t store.Task) string {
	switch t.Kind {
	case "hospital_bag":
		return HospitalBag
	case "paperwork":
		return Paperwork
	}
	title := strings.ToLower(t.Title)
	switch {
	case appointmentRe.MatchString(title):
		return Appointments
	case paperworkRe.MatchString(title):
		return Paperwork
	case learningRe.MatchString(title):
		return Learning
	case shoppingRe.MatchString(title):
		return Shopping
	}
	return Planning
}

// IsNight reports whether a care entry started between 22:00 and 06:00 UTC.
// Families have no time zone yet; the demo seeds in UTC.
func IsNight(t time.Time) bool {
	h := t.UTC().Hour()
	return h >= 22 || h < 6
}

type Share struct {
	MemberID    uuid.UUID
	Count       int
	RecentCount *int
}

// Item is a task behind a task area, for the screen to open.
type Item struct {
	Task    store.Task
	Due     *time.Time
	Offered *uuid.UUID
}

type Area struct {
	Key, Label, Unit string
	Items            []Item
	Owned, Started   []Share
	Handover         []uuid.UUID
	OfferedToMe      []uuid.UUID
	OfferedByMe      []uuid.UUID
}

type Input struct {
	Now    time.Time
	Actor  uuid.UUID
	Tasks  []tasks.Item
	Care   []store.CareLogEntry
	Shifts []store.Shift
}

type tally map[uuid.UUID]*Share

func (t tally) add(id uuid.UUID, recent bool, trackRecent bool) {
	s, ok := t[id]
	if !ok {
		s = &Share{MemberID: id}
		if trackRecent {
			s.RecentCount = new(int)
		}
		t[id] = s
	}
	s.Count++
	if recent && s.RecentCount != nil {
		*s.RecentCount++
	}
}

func (t tally) list() []Share {
	out := make([]Share, 0, len(t))
	for _, s := range t {
		out = append(out, *s)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].MemberID.String() < out[j].MemberID.String()
	})
	return out
}

func total(s []Share) int {
	n := 0
	for _, x := range s {
		n += x.Count
	}
	return n
}

// Build counts the areas. Areas without anything in them are left out; the
// busiest comes first.
func Build(in Input) []Area {
	since := in.Now.AddDate(0, 0, -WindowDays)
	recentSince := in.Now.AddDate(0, 0, -RecentDays)
	byKey := map[string]*Area{}
	owned := map[string]tally{}
	started := map[string]tally{}
	get := func(key string) *Area {
		a, ok := byKey[key]
		if !ok {
			m := areas[key]
			a = &Area{Key: key, Label: m.label, Unit: m.unit, Handover: []uuid.UUID{}, OfferedToMe: []uuid.UUID{}, OfferedByMe: []uuid.UUID{}}
			byKey[key] = a
			owned[key], started[key] = tally{}, tally{}
		}
		return a
	}

	for _, it := range in.Tasks {
		t := it.Task
		if t.Done && (!t.DoneAt.Valid || t.DoneAt.Time.Before(since)) {
			continue
		}
		key := AreaOfTask(t)
		a := get(key)
		owned[key].add(t.AssigneeMemberID, false, false)
		li := Item{Task: t, Due: it.Deadline.On}
		if t.PendingAssigneeMemberID.Valid && !t.Done {
			id := t.PendingAssigneeMemberID.UUID
			li.Offered = &id
		}
		a.Items = append(a.Items, li)
		started[key].add(t.CreatedByMemberID, false, false)
		if t.Done {
			continue
		}
		offeredTo := t.PendingAssigneeMemberID
		switch {
		case offeredTo.Valid && offeredTo.UUID == in.Actor:
			a.OfferedToMe = append(a.OfferedToMe, t.ID)
		case t.AssigneeMemberID == in.Actor && offeredTo.Valid:
			a.OfferedByMe = append(a.OfferedByMe, t.ID)
		case t.AssigneeMemberID == in.Actor:
			a.Handover = append(a.Handover, t.ID)
		}
	}

	for _, e := range in.Care {
		if e.StartedAt.Before(since) || e.StartedAt.After(in.Now) {
			continue
		}
		key := ""
		switch {
		case e.Kind == "sleep":
			continue // the baby sleeping is not work anyone carries
		case IsNight(e.StartedAt):
			key = Nights
		case e.Kind == "feed":
			key = Feeding
		case e.Kind == "diaper":
			key = Diapers
		}
		get(key)
		owned[key].add(e.AuthorMemberID, !e.StartedAt.Before(recentSince), true)
	}

	hours := map[uuid.UUID]float64{}
	for _, s := range in.Shifts {
		if s.Status != "active" {
			continue
		}
		hours[s.MemberID] += float64(len(s.Days)) * shiftHours(s.StartTime, s.EndTime)
	}
	for id, h := range hours {
		if int(h+0.5) > 0 {
			get(CareShifts)
			owned[CareShifts][id] = &Share{MemberID: id, Count: int(h + 0.5)}
		}
	}

	out := make([]Area, 0, len(byKey))
	for key, a := range byKey {
		a.Owned = owned[key].list()
		if _, isTask := taskAreas[key]; isTask {
			a.Started = started[key].list()
		}
		if total(a.Owned) == 0 {
			continue
		}
		sort.SliceStable(a.Items, func(i, j int) bool {
			x, y := a.Items[i].Task, a.Items[j].Task
			if x.Done != y.Done {
				return !x.Done
			}
			dx, dy := a.Items[i].Due, a.Items[j].Due
			if (dx != nil) != (dy != nil) {
				return dx != nil
			}
			if dx != nil && !dx.Equal(*dy) {
				return dx.Before(*dy)
			}
			return x.Title < y.Title
		})
		out = append(out, *a)
	}
	sort.Slice(out, func(i, j int) bool {
		ti, tj := total(out[i].Owned), total(out[j].Owned)
		if ti != tj {
			return ti > tj
		}
		return out[i].Key < out[j].Key
	})
	return out
}

var taskAreas = map[string]bool{Appointments: true, Shopping: true, Paperwork: true, HospitalBag: true, Learning: true, Planning: true}

func shiftHours(start, end string) float64 {
	s, e := clock(start), clock(end)
	if e <= s {
		e += 24 * time.Hour
	}
	return (e - s).Hours()
}

func clock(hhmm string) time.Duration {
	t, err := time.Parse("15:04", hhmm)
	if err != nil {
		return 0
	}
	return time.Duration(t.Hour())*time.Hour + time.Duration(t.Minute())*time.Minute
}

// Load reads the family's data and builds the map for the acting parent.
func Load(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, now time.Time) ([]Area, []uuid.UUID, error) {
	q := store.New(pool)
	items, err := tasks.ListWith(ctx, q, familyID, nil)
	if err != nil {
		return nil, nil, err
	}
	care, err := q.ListCareLogEntries(ctx, store.ListCareLogEntriesParams{FamilyID: familyID, Since: now.AddDate(0, 0, -WindowDays)})
	if err != nil {
		return nil, nil, err
	}
	shifts, err := q.ListActiveShifts(ctx, familyID)
	if err != nil {
		return nil, nil, err
	}
	parents, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return nil, nil, err
	}
	caregivers, err := q.ListCaregivers(ctx, familyID)
	if err != nil {
		return nil, nil, err
	}
	// Whoever Propose accepts as a target: parents, and caregivers with family_plan.
	takers := []uuid.UUID{}
	for _, m := range append(parents, caregivers...) {
		if m.ID != actor && (tasks.Person{ID: m.ID, Role: m.Role, Permissions: m.Permissions}).CanUse() {
			takers = append(takers, m.ID)
		}
	}
	return Build(Input{Now: now, Actor: actor, Tasks: items, Care: care, Shifts: shifts}), takers, nil
}
