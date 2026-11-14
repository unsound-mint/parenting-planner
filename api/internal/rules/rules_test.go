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
	// daysToDue is the due date minus today; 280 is the first counted day.
	cases := []struct {
		name      string
		today     time.Time
		daysToDue int
		want      int
		ok        bool
	}{
		{"first counted day", today, 280, 0, true},
		{"last day of week 0", today, 274, 0, true},
		{"first day of week 1", today, 273, 1, true},
		{"last day of week 24", today, 106, 24, true},
		{"first day of week 25", today, 105, 25, true},
		{"due date", today, 0, 40, true},
		{"one day past due", today, -1, 40, true},
		{"two weeks past due", today, -14, 42, true},
		{"day before the counted start", today, 281, 0, false},
		{"due date years away", today, 1000, 0, false},
		{"across a leap day", day(2028, 3, 1), 140, 20, true},
		{"today given late in the day", today.Add(23*time.Hour + 59*time.Minute), 273, 1, true},
		{"today given in another zone", time.Date(2026, 11, 14, 1, 0, 0, 0, time.FixedZone("UTC+5", 5*3600)), 273, 1, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			y, m, d := c.today.Date()
			due := time.Date(y, m, d, 0, 0, 0, 0, time.UTC).AddDate(0, 0, c.daysToDue)
			f := Facts{Today: c.today, Stage: "pregnancy", DueDate: &due}
			w, ok := f.GestationalWeek()
			if w != c.want || ok != c.ok {
				t.Errorf("got (%d, %v), want (%d, %v)", w, ok, c.want, c.ok)
			}
		})
	}
	due := today.AddDate(0, 0, 100)
	for name, f := range map[string]Facts{
		"no due date":      {Today: today, Stage: "pregnancy"},
		"not in pregnancy": {Today: today, Stage: "newborn", DueDate: &due},
	} {
		if _, ok := f.GestationalWeek(); ok {
			t.Errorf("%s: want no week", name)
		}
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
