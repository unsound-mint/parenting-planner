package content

import (
	"strings"
	"testing"
	"time"
)

func dayAt(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

// Every day of a child's life from birth to age 12 lands on an entry, and
// every entry has text, a note and at least one opened source.
func TestEveryAgePeriodHasASourcedLine(t *testing.T) {
	birth := dayAt(2015, time.January, 31) // a month-end birthday exercises the month maths
	seen := map[string]bool{}
	for d := 0; d < 12*366; d++ {
		today := birth.AddDate(0, 0, d)
		l := NowForChild(birth, today)
		if l.Headline == "" || l.Detail == "" || l.PlayIdea == "" || l.Note == "" || l.Period == "" {
			t.Fatalf("day %d: incomplete line %+v", d, l)
		}
		if len(l.Sources) == 0 {
			t.Fatalf("day %d: no sources", d)
		}
		seen[l.Period+"|"+l.Headline] = true
	}
	// 12 weeks of life, months 3 to 11, months 12 to 24, 2 half-year bands to 2.5, 4 to 4.5, 5 to 9 years.
	if want := 12 + 9 + 13 + 2 + 4 + 5; len(seen) != want {
		t.Errorf("distinct lines = %d, want %d", len(seen), want)
	}
}

func TestStageNowTextIsPlainAndSourcesAreChecked(t *testing.T) {
	var all []NowLine
	for _, w := range stageNow.weeks {
		all = append(all, w)
	}
	for _, r := range stageNow.ranges {
		all = append(all, r.line)
	}
	for _, p := range stageNow.planning {
		all = append(all, p)
	}
	checked := dayAt(2026, time.November, 14)
	for _, l := range all {
		for _, text := range []string{l.Period, l.Headline, l.Detail, l.PlayIdea, l.Note} {
			if strings.ContainsAny(text, "–—") {
				t.Errorf("%s: dash in %q", l.Period, text)
			}
		}
		for _, s := range l.Sources {
			if s.Title == "" || !strings.HasPrefix(s.URL, "https://") || !s.CheckedAt.Equal(checked) {
				t.Errorf("%s: bad source %+v", l.Period, s)
			}
		}
	}
	if len(stageNow.planning) != 2 {
		t.Errorf("want planning and trying lines, got %d", len(stageNow.planning))
	}
}

func TestNowForChildPicksWeekThenMonth(t *testing.T) {
	birth := dayAt(2026, time.June, 1)
	cases := []struct {
		days   int
		period string
	}{
		{-3, "Week 1 of life"}, // birth date in the future never panics
		{0, "Week 1 of life"},
		{49, "Week 8 of life"},
		{83, "Week 12 of life"},
		{84, "3 months"}, // week 13, even though only 2 calendar months have passed
	}
	for _, tc := range cases {
		if got := NowForChild(birth, birth.AddDate(0, 0, tc.days)).Period; got != tc.period {
			t.Errorf("day %d: %q, want %q", tc.days, got, tc.period)
		}
	}
	if got := NowForChild(birth, birth.AddDate(4, 1, 0)).Period; got != "4 years" {
		t.Errorf("4 years 1 month: %q", got)
	}
	if got := NowForChild(birth, birth.AddDate(14, 0, 0)).Period; got != "9 years and up" {
		t.Errorf("14 years: %q", got)
	}
}
