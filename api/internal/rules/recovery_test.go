package rules

import "testing"

func TestRecoveryUrgent(t *testing.T) {
	cases := []struct {
		bleeding string
		signs    []string
		want     bool
	}{
		{"light", nil, false},
		{"none", []string{}, false},
		{"heavy", nil, true},
		{"spotting", []string{"fever"}, true},
		{"none", []string{"self_harm_thoughts"}, true},
	}
	for _, c := range cases {
		if got := RecoveryUrgent(c.bleeding, c.signs); got != c.want {
			t.Errorf("RecoveryUrgent(%q, %v) = %v, want %v", c.bleeding, c.signs, got, c.want)
		}
	}
}

func TestPostnatalCheckWindow(t *testing.T) {
	birth := day(2026, 10, 1)
	for _, c := range []struct {
		days int
		want string
	}{{10, "upcoming"}, {41, "upcoming"}, {42, "open"}, {56, "open"}, {57, "overdue"}} {
		if got := PostnatalCheckWindow(birth, birth.AddDate(0, 0, c.days)).Status; got != c.want {
			t.Errorf("day %d: %s, want %s", c.days, got, c.want)
		}
	}
}

func TestFourthTrimesterEveryPhaseIsSourced(t *testing.T) {
	seen := map[string]bool{}
	for _, d := range []int{0, 20, 21, 41, 42, 84, 85, 200} {
		g := FourthTrimester(d)
		seen[g.Phase] = true
		if g.Headline == "" || len(g.Points) == 0 || len(g.Sources) == 0 {
			t.Errorf("day %d: incomplete guidance %+v", d, g)
		}
		for _, s := range g.Sources {
			if s.URL == "" || s.CheckedAt.IsZero() {
				t.Errorf("day %d: source without url or checked date", d)
			}
		}
	}
	if len(seen) != 4 {
		t.Errorf("phases seen: %v", seen)
	}
}
