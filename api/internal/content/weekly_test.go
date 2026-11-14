package content

import (
	"strings"
	"testing"
	"time"
)

func TestEveryWeekMonthAndYearHasARead(t *testing.T) {
	for kind, r := range WeeklyReadKinds() {
		for n := r[0]; n <= r[1]; n++ {
			read, ok := LookupWeeklyRead(kind, n)
			if !ok {
				t.Errorf("%s %d has no read", kind, n)
				continue
			}
			if read.Title == "" || len(read.Body) < 150 || len(read.Body) > 700 {
				t.Errorf("%s %d: title %q, body %d chars", kind, n, read.Title, len(read.Body))
			}
			if len(read.Sources) < 1 || len(read.Sources) > 3 {
				t.Errorf("%s %d: %d sources, want 1 to 3", kind, n, len(read.Sources))
			}
			for _, s := range read.Sources {
				if !strings.HasPrefix(s.URL, "https://") || s.CheckedAt.IsZero() {
					t.Errorf("%s %d: source %+v", kind, n, s)
				}
			}
			// Our voice: no em dashes, no exclamation marks.
			if strings.ContainsAny(read.Title+read.Body, "—!") {
				t.Errorf("%s %d: em dash or exclamation mark", kind, n)
			}
		}
	}
}

func TestWeeklyReadsForFollowsTheClock(t *testing.T) {
	d := func(s string) time.Time {
		v, err := time.Parse("2006-01-02", s)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
	ptr := func(v time.Time) *time.Time { return &v }
	today := d("2026-11-15")
	for _, c := range []struct {
		name         string
		stage        string
		due, birth   *time.Time
		today        time.Time
		kind         string
		n            int
		total        int
		startsOn     string
		endsOn       string
		openEnded    bool
		noDateExpect bool
	}{
		// Due in 15 weeks: 25 completed weeks, like the weekly card.
		{name: "pregnancy week 25", stage: "pregnancy", due: ptr(today.AddDate(0, 0, 15*7)), today: today, kind: ReadPregnancy, n: 25, total: 40, startsOn: "2026-11-15", endsOn: "2026-11-21"},
		{name: "a skipped week moves the read", stage: "pregnancy", due: ptr(today.AddDate(0, 0, 15*7)), today: today.AddDate(0, 0, 7), kind: ReadPregnancy, n: 26, total: 40},
		{name: "first days of pregnancy count as week 1", stage: "pregnancy", due: ptr(today.AddDate(0, 0, 278)), today: today, kind: ReadPregnancy, n: 1, total: 40},
		{name: "past the due date stays on week 40", stage: "pregnancy", due: ptr(today.AddDate(0, 0, -10)), today: today, kind: ReadPregnancy, n: 40, total: 40, openEnded: true},
		{name: "born today", stage: "postpartum", birth: ptr(today), today: today, kind: ReadBabyWeek, n: 0, total: 83, startsOn: "2026-11-15", endsOn: "2026-11-21"},
		{name: "ten days old", stage: "postpartum", birth: ptr(today.AddDate(0, 0, -10)), today: today, kind: ReadBabyWeek, n: 1, total: 83},
		{name: "stored infant stage, child now 14 months", stage: "infant", birth: ptr(d("2025-09-10")), today: today, kind: ReadMonth, n: 14, total: 83, startsOn: "2026-11-10", endsOn: "2026-12-09"},
		{name: "23 months", stage: "toddler", birth: ptr(d("2024-12-01")), today: today, kind: ReadMonth, n: 23, total: 83},
		{name: "week 52 runs past the birthday", stage: "infant", birth: ptr(today.AddDate(-1, 0, -2)), today: today, kind: ReadBabyWeek, n: 52, total: 83},
		{name: "four years", stage: "preschool", birth: ptr(d("2022-06-01")), today: today, kind: ReadYear, n: 4, total: 83},
		{name: "ten years stays on 8", stage: "school_age", birth: ptr(d("2016-01-01")), today: today, kind: ReadYear, n: 8, total: 83, openEnded: true},
		{name: "planning", stage: "planning", today: today, kind: ReadPlanning, n: 0, total: 1, noDateExpect: true},
		{name: "after birth without a child", stage: "infant", today: today, kind: ReadPlanning, n: 0, total: 1, noDateExpect: true},
		{name: "pregnant with an older child reads pregnancy", stage: "pregnancy", due: ptr(today.AddDate(0, 0, 20*7)), birth: ptr(d("2023-01-01")), today: today, kind: ReadPregnancy, n: 20, total: 40},
	} {
		t.Run(c.name, func(t *testing.T) {
			items, cur := WeeklyReadsFor(c.stage, c.due, c.birth, c.today)
			if len(items) != c.total {
				t.Fatalf("%d items, want %d", len(items), c.total)
			}
			got := items[cur]
			if got.Kind != c.kind || got.N != c.n {
				t.Fatalf("current = %s %d, want %s %d", got.Kind, got.N, c.kind, c.n)
			}
			if c.noDateExpect {
				if got.Starts != nil {
					t.Errorf("planning read has a date")
				}
				return
			}
			if got.Starts == nil || got.Starts.After(c.today) {
				t.Errorf("starts %v, today %v", got.Starts, c.today)
			}
			if c.openEnded != (got.Ends == nil) {
				t.Errorf("ends %v, open ended %v", got.Ends, c.openEnded)
			}
			if got.Ends != nil && got.Ends.Before(c.today) {
				t.Errorf("ends %v before today %v", got.Ends, c.today)
			}
			if c.startsOn != "" && got.Starts.Format(time.DateOnly) != c.startsOn {
				t.Errorf("starts %s, want %s", got.Starts.Format(time.DateOnly), c.startsOn)
			}
			if c.endsOn != "" && got.Ends.Format(time.DateOnly) != c.endsOn {
				t.Errorf("ends %s, want %s", got.Ends.Format(time.DateOnly), c.endsOn)
			}
		})
	}
}

func TestReadsDoNotOverlap(t *testing.T) {
	birth := time.Date(2024, 1, 31, 0, 0, 0, 0, time.UTC)
	items, _ := WeeklyReadsFor("toddler", nil, &birth, birth)
	for i := 1; i < len(items); i++ {
		prev, cur := items[i-1], items[i]
		if prev.Ends == nil || !prev.Ends.AddDate(0, 0, 1).Equal(*cur.Starts) {
			t.Errorf("%s ends %v, %s starts %v", prev.ID(), prev.Ends, cur.ID(), cur.Starts)
		}
	}
}

func TestStageAfterBirth(t *testing.T) {
	for _, c := range []struct {
		stored string
		months int
		want   string
	}{
		{"infant", 14, "toddler"},
		{"postpartum", 2, "postpartum"},
		{"infant", 3, "infant"},
		{"toddler", 36, "preschool"},
		{"preschool", 61, "school_age"},
		{"pregnancy", 30, "pregnancy"},
		{"planning", 0, "planning"},
	} {
		if got := StageAfterBirth(c.stored, c.months); got != c.want {
			t.Errorf("StageAfterBirth(%s, %d) = %s, want %s", c.stored, c.months, got, c.want)
		}
	}
}
