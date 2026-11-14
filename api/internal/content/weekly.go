package content

import (
	"embed"
	"encoding/json"
	"fmt"
	"time"
)

// The weekly reads: one short read for every week of pregnancy, every week of
// the first year, every month to age 3 and every year to 9, plus one for
// families getting ready. learn_weeks_pregnancy.json, learn_weeks_baby.json and
// learn_weeks_child.json hold them in the same shape, each with its own sources
// map; every source was fetched on its checkedAt date and the bodies are our own
// plain-language paraphrase of the linked pages. weekly_test.go checks that no
// week, month or year is missing.
//
//go:embed learn_weeks_*.json
var weeklyFiles embed.FS

// Read kinds, in the order a family meets them.
const (
	ReadPlanning  = "planning"
	ReadPregnancy = "pregnancy_week"
	ReadBabyWeek  = "baby_week"
	ReadMonth     = "month"
	ReadYear      = "year"
)

// The ranges each kind covers. A child's first year is weeks 0 to 52 of life
// (week 0 is the first 7 days); months 12 to 35 follow, then years 3 to 8,
// where 8 also serves older children.
const (
	firstPregnancyWeek, lastPregnancyWeek = 1, 40
	lastBabyWeek                          = 52
	firstMonth, lastMonth                 = 12, 35
	firstYear, lastYear                   = 3, 8
)

// WeeklyRead is one read: a short title, a few sentences and the pages they
// come from.
type WeeklyRead struct {
	Kind    string
	N       int
	Title   string
	Body    string
	Sources []Source
}

// ID is stable across loads: the kind and its number.
func (r WeeklyRead) ID() string { return fmt.Sprintf("%s-%d", r.Kind, r.N) }

// Label names the read's week or age for a heading.
func (r WeeklyRead) Label() string {
	switch r.Kind {
	case ReadPlanning:
		return "Getting ready"
	case ReadPregnancy:
		return fmt.Sprintf("Week %d", r.N)
	case ReadBabyWeek:
		// Week 0 is the first week of life; people count it as week 1. The
		// last one holds the first birthday.
		if r.N == lastBabyWeek {
			return "First birthday"
		}
		return fmt.Sprintf("Week %d", r.N+1)
	case ReadMonth:
		return fmt.Sprintf("%d months", r.N)
	case ReadYear:
		if r.N == lastYear {
			return fmt.Sprintf("Age %d and up", r.N)
		}
		return fmt.Sprintf("Age %d", r.N)
	}
	return ""
}

// DatedRead is a read placed on the family's calendar. Starts and Ends are
// nil for the planning read; Ends is nil for pregnancy week 40 and the last
// year, which stay open.
type DatedRead struct {
	WeeklyRead
	Starts, Ends *time.Time
}

var weeklyReads = loadWeekly()

func loadWeekly() map[string]map[int]WeeklyRead {
	files, err := weeklyFiles.ReadDir(".")
	if err != nil {
		panic(err)
	}
	out := map[string]map[int]WeeklyRead{}
	for _, f := range files {
		raw, err := weeklyFiles.ReadFile(f.Name())
		if err != nil {
			panic(err)
		}
		var file struct {
			Sources map[string]struct{ Title, URL, CheckedAt string } `json:"sources"`
			Entries []struct {
				Kind    string   `json:"kind"`
				N       int      `json:"n"`
				Title   string   `json:"title"`
				Body    string   `json:"body"`
				Sources []string `json:"sources"`
			} `json:"entries"`
		}
		if err := json.Unmarshal(raw, &file); err != nil {
			panic(fmt.Sprintf("%s: %v", f.Name(), err))
		}
		for _, e := range file.Entries {
			r := WeeklyRead{Kind: e.Kind, N: e.N, Title: e.Title, Body: e.Body}
			for _, id := range e.Sources {
				s, ok := file.Sources[id]
				if !ok {
					panic(fmt.Sprintf("%s: unknown source %s", f.Name(), id))
				}
				at, err := time.Parse("2006-01-02", s.CheckedAt)
				if err != nil {
					panic(fmt.Sprintf("%s: bad checkedAt for %s", f.Name(), id))
				}
				r.Sources = append(r.Sources, Source{Title: s.Title, URL: s.URL, CheckedAt: at})
			}
			if out[e.Kind] == nil {
				out[e.Kind] = map[int]WeeklyRead{}
			}
			if _, dup := out[e.Kind][e.N]; dup {
				panic(fmt.Sprintf("%s: %s %d twice", f.Name(), e.Kind, e.N))
			}
			out[e.Kind][e.N] = r
		}
	}
	return out
}

// WeeklyReadsFor returns the reads of the family's track and the index of the
// one for today: pregnancy weeks when the family is pregnant with a due date,
// the youngest child's weeks, months and years after a birth, and the
// planning read otherwise (also for a stage after birth with no child on
// record). Every date comes from the due date or the birth date and today,
// so the demo clock moves the current read.
//
// Pregnancy week n is the n-th completed week, as on the weekly card
// (rules.Facts.GestationalWeek), kept within 1 to 40.
func WeeklyReadsFor(stage string, due, birth *time.Time, today time.Time) ([]DatedRead, int) {
	day := func(t time.Time) *time.Time { return &t }
	switch {
	case stage == "pregnancy" && due != nil:
		start := due.AddDate(0, 0, -280)
		var items []DatedRead
		for n := firstPregnancyWeek; n <= lastPregnancyWeek; n++ {
			r := DatedRead{WeeklyRead: weeklyReads[ReadPregnancy][n], Starts: day(start.AddDate(0, 0, 7*n)), Ends: day(start.AddDate(0, 0, 7*n+6))}
			switch n {
			case firstPregnancyWeek: // also covers completed week 0
				r.Starts = day(start)
			case lastPregnancyWeek: // stays until the birth
				r.Ends = nil
			}
			items = append(items, r)
		}
		week := daysBetween(start, today) / 7
		return items, min(max(week, firstPregnancyWeek), lastPregnancyWeek) - firstPregnancyWeek
	case stage != "planning" && stage != "trying" && stage != "pregnancy" && birth != nil:
		return childReads(*birth, today)
	}
	return []DatedRead{{WeeklyRead: weeklyReads[ReadPlanning][0]}}, 0
}

func childReads(birth, today time.Time) ([]DatedRead, int) {
	day := func(t time.Time) *time.Time { return &t }
	var items []DatedRead
	for n := 0; n <= lastBabyWeek; n++ {
		from := birth.AddDate(0, 0, 7*n)
		items = append(items, DatedRead{weeklyReads[ReadBabyWeek][n], day(from), day(from.AddDate(0, 0, 6))})
	}
	// Week 52 of life ends a few days after the first birthday; month 12
	// starts the day after it.
	firstYearEnds := birth.AddDate(0, 0, 7*(lastBabyWeek+1))
	for n := firstMonth; n <= lastMonth; n++ {
		from := birth.AddDate(0, n, 0)
		if n == firstMonth {
			from = firstYearEnds
		}
		items = append(items, DatedRead{weeklyReads[ReadMonth][n], day(from), day(birth.AddDate(0, n+1, -1))})
	}
	for n := firstYear; n <= lastYear; n++ {
		r := DatedRead{WeeklyRead: weeklyReads[ReadYear][n], Starts: day(birth.AddDate(n, 0, 0))}
		if n < lastYear {
			r.Ends = day(birth.AddDate(n+1, 0, -1))
		}
		items = append(items, r)
	}
	// Today's read is the last one that has started.
	cur := 0
	for i, r := range items {
		if !today.Before(*r.Starts) {
			cur = i
		}
	}
	return items, cur
}

// WeeklyReadKinds lists every kind with its first and last number, for tests.
func WeeklyReadKinds() map[string][2]int {
	return map[string][2]int{
		ReadPlanning:  {0, 0},
		ReadPregnancy: {firstPregnancyWeek, lastPregnancyWeek},
		ReadBabyWeek:  {0, lastBabyWeek},
		ReadMonth:     {firstMonth, lastMonth},
		ReadYear:      {firstYear, lastYear},
	}
}

// LookupWeeklyRead returns one read, for tests.
func LookupWeeklyRead(kind string, n int) (WeeklyRead, bool) {
	r, ok := weeklyReads[kind][n]
	return r, ok
}

// daysBetween counts calendar days from a to b, ignoring the time of day.
func daysBetween(a, b time.Time) int {
	ay, am, ad := a.Date()
	by, bm, bd := b.Date()
	return int(time.Date(by, bm, bd, 0, 0, 0, 0, time.UTC).Sub(time.Date(ay, am, ad, 0, 0, 0, 0, time.UTC)).Hours() / 24)
}

// StageAfterBirth is the content stage of a family whose youngest child is
// ageMonths old: the stored stage while it is not a stage after birth
// (pregnancy with an older child stays pregnancy), else the stage the age
// falls in. The bands match the stages a visitor picks on the landing page
// (demo.childStages) and the journey timeline.
func StageAfterBirth(stored string, ageMonths int) string {
	switch stored {
	case "postpartum", "infant", "toddler", "preschool", "school_age":
	default:
		return stored
	}
	switch {
	case ageMonths < 3:
		return "postpartum"
	case ageMonths < 12:
		return "infant"
	case ageMonths < 36:
		return "toddler"
	case ageMonths < 60:
		return "preschool"
	}
	return "school_age"
}
