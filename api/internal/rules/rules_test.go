package rules

import (
	"testing"
	"time"
)

var today = day(2026, 11, 14)

// pregnantAt builds facts for a pregnancy at the given completed week.
func pregnantAt(week int, viewer Role) Facts {
	due := today.AddDate(0, 0, pregnancyDays-week*7)
	return Facts{
		Today:         today,
		Viewer:        viewer,
		Stage:         "pregnancy",
		DueDate:       &due,
		PregnancyLabs: map[string]time.Time{},
		Immunizations: map[Role]map[string]time.Time{Mother: {}, Partner: {}},
		CareTeam:      map[string]bool{},
	}
}

func find(items []Item, id string) *Item {
	for i := range items {
		if items[i].RuleID == id {
			return &items[i]
		}
	}
	return nil
}

func TestGestationalWeek(t *testing.T) {
	if w, _ := pregnantAt(25, Mother).GestationalWeek(); w != 25 {
		t.Fatalf("got week %d, want 25", w)
	}
}

func TestGlucoseScreen(t *testing.T) {
	cases := []struct {
		week int
		done bool
		want Status // "" means the rule must not apply
	}{
		{20, false, ""},
		{23, false, Upcoming},
		{25, false, Due},
		{30, false, Due},
		{25, true, ""},
	}
	for _, c := range cases {
		f := pregnantAt(c.week, Mother)
		if c.done {
			f.PregnancyLabs["glucose_screen"] = today
		}
		it := find(Plan(All(), f), "glucose-screen")
		if c.want == "" {
			if it != nil {
				t.Errorf("week %d done=%v: rule applied, want none", c.week, c.done)
			}
			continue
		}
		if it == nil || it.Status != c.want {
			t.Errorf("week %d done=%v: got %+v, want %s", c.week, c.done, it, c.want)
		}
	}
}

func TestTdapCountsOnlyThisPregnancy(t *testing.T) {
	f := pregnantAt(30, Mother)
	f.Immunizations[Mother]["tdap"] = f.PregnancyStart().AddDate(0, 0, -30) // previous pregnancy
	if it := find(Plan(All(), f), "tdap-pregnancy"); it == nil || it.Status != Due {
		t.Fatalf("Tdap before this pregnancy must not count, got %+v", it)
	}
	f.Immunizations[Mother]["tdap"] = today
	if it := find(Plan(All(), f), "tdap-pregnancy"); it != nil {
		t.Fatalf("Tdap in this pregnancy should clear the item, got %+v", it)
	}
}

func TestAudienceSeparatesParents(t *testing.T) {
	mom := Plan(All(), pregnantAt(30, Mother))
	partner := Plan(All(), pregnantAt(30, Partner))
	if find(mom, "tdap-partner") != nil || find(partner, "tdap-pregnancy") != nil {
		t.Fatal("each parent must only get rules addressed to them")
	}
	if find(partner, "tdap-partner") == nil {
		t.Fatal("partner without Tdap should get the partner Tdap item")
	}
}

func TestPlanSortsByUrgency(t *testing.T) {
	items := Plan(All(), pregnantAt(35, Mother)) // glucose due, Tdap due, GBS upcoming
	for i := 1; i < len(items); i++ {
		if statusOrder[items[i-1].Status] > statusOrder[items[i].Status] {
			t.Fatalf("items not sorted by status: %v then %v", items[i-1].Status, items[i].Status)
		}
	}
}

func TestEveryRuleIsSourced(t *testing.T) {
	for _, r := range All() {
		if r.Source.URL == "" || r.Source.CheckedAt.IsZero() {
			t.Errorf("rule %s has no source or checked date", r.ID)
		}
	}
}

func TestLowMoodStreak(t *testing.T) {
	f := pregnantAt(25, Partner)
	low := func(daysAgo int) MoodSample { return MoodSample{At: today.AddDate(0, 0, -daysAgo), Mood: 2} }

	f.RecentMoods = []MoodSample{low(1), low(2)}
	if find(Plan(All(), f), "low-mood-partner") != nil {
		t.Fatal("two low days must not trigger")
	}
	f.RecentMoods = append(f.RecentMoods, low(3))
	if it := find(Plan(All(), f), "low-mood-partner"); it == nil || it.Category != MentalHealth {
		t.Fatalf("three low days in a week must trigger, got %+v", it)
	}
	f.RecentMoods = []MoodSample{low(1), low(2), low(10)}
	if find(Plan(All(), f), "low-mood-partner") != nil {
		t.Fatal("check-ins older than the window must not count")
	}
}

func TestGBSScreen(t *testing.T) {
	cases := []struct {
		week int
		done bool
		want Status
	}{
		{33, false, ""},
		{34, false, Upcoming},
		{36, false, Due},
		{37, false, Due},
		{38, false, Overdue},
		{36, true, ""},
	}
	for _, c := range cases {
		f := pregnantAt(c.week, Mother)
		if c.done {
			f.PregnancyLabs["gbs"] = today
		}
		it := find(Plan(All(), f), "gbs-screen")
		if c.want == "" {
			if it != nil {
				t.Errorf("week %d done=%v: rule applied, want none", c.week, c.done)
			}
			continue
		}
		if it == nil || it.Status != c.want {
			t.Errorf("week %d done=%v: got %+v, want %s", c.week, c.done, it, c.want)
		}
	}
	if find(Plan(All(), pregnantAt(36, Partner)), "gbs-screen") != nil {
		t.Error("GBS is for the mother only")
	}
}

func TestLowMoodGoesToTheRightParent(t *testing.T) {
	low := []MoodSample{{today.AddDate(0, 0, -1), 1}, {today.AddDate(0, 0, -2), 2}, {today.AddDate(0, 0, -3), 2}}
	mom := pregnantAt(25, Mother)
	mom.RecentMoods = low
	items := Plan(All(), mom)
	if find(items, "low-mood-mother") == nil || find(items, "low-mood-partner") != nil {
		t.Fatalf("mother's low mood must produce low-mood-mother only, got %+v", items)
	}
}

func TestNextPsychologistSession(t *testing.T) {
	daysAgo := func(n int) *time.Time { d := today.AddDate(0, 0, -n); return &d }
	cases := []struct {
		name   string
		viewer Role
		noteAt *time.Time
		booked bool
		want   bool
	}{
		{"no note yet", Mother, nil, false, false},
		{"note written, nothing booked", Mother, daysAgo(2), false, true},
		{"note written, next session booked", Mother, daysAgo(2), true, false},
		{"note older than the window", Mother, daysAgo(20), false, false},
		{"the partner's own note", Partner, daysAgo(1), false, true},
	}
	for _, c := range cases {
		f := pregnantAt(25, c.viewer)
		f.LastSessionNoteAt, f.NextSessionBooked = c.noteAt, c.booked
		it := find(Plan(All(), f), "psychologist-next-session")
		if (it != nil) != c.want {
			t.Errorf("%s: got %+v, want applied=%v", c.name, it, c.want)
		}
		if it != nil && (it.Status != Due || it.Category != MentalHealth) {
			t.Errorf("%s: got %+v, want a due mental health item", c.name, it)
		}
	}
}
