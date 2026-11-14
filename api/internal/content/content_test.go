package content

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/rules"
)

// Every URL in the catalog must appear in docs/guidelines on a row that is not
// marked (verify). This is the guard behind "never invent a source".
func TestSourcesComeFromTheGuidelineDocs(t *testing.T) {
	good := map[string]bool{}
	for _, f := range []string{"pregnancy", "postpartum", "baby-0-24m", "child-2-9y"} {
		b, err := os.ReadFile("../../../docs/guidelines/" + f + ".md")
		if err != nil {
			t.Fatal(err)
		}
		for _, line := range strings.Split(string(b), "\n") {
			if strings.Contains(line, "(verify") {
				continue
			}
			for _, u := range regexp.MustCompile(`\]\((https?://[^)]+)\)`).FindAllStringSubmatch(line, -1) {
				good[u[1]] = true
			}
		}
	}
	for _, g := range All() {
		checkSource(t, g.ID, g.Source, good)
	}
	for _, w := range windows {
		checkSource(t, "window", w.source, good)
	}
}

func checkSource(t *testing.T, what string, s Source, good map[string]bool) {
	t.Helper()
	if s.Title == "" || s.URL == "" || s.CheckedAt.IsZero() {
		t.Errorf("%s: source needs title, url and checked date: %+v", what, s)
	}
	if !good[s.URL] {
		t.Errorf("%s: %s is not on a non-(verify) row in docs/guidelines", what, s.URL)
	}
}

func TestGuideInvariants(t *testing.T) {
	seen := map[string]bool{}
	for _, g := range All() {
		if seen[g.ID] {
			t.Errorf("duplicate id %s", g.ID)
		}
		seen[g.ID] = true
		if g.Title == "" || g.Summary == "" || len(g.Steps) == 0 || len(g.Stages) == 0 || len(g.Audience) == 0 {
			t.Errorf("%s: incomplete entry", g.ID)
		}
		pregnancy := len(g.Stages) == 1 && g.Stages[0] == "pregnancy"
		if pregnancy != (g.Weeks != nil) {
			t.Errorf("%s: pregnancy guides, and only they, carry a week range", g.ID)
		}
		if g.Weeks != nil && g.Ages != nil {
			t.Errorf("%s: week range and age range together", g.ID)
		}
		if g.Kind == BirthPrep && (g.Weeks == nil || g.Weeks.From < 28) {
			t.Errorf("%s: birth prep must start at week 28 or later", g.ID)
		}
	}
	if !seen["birth-prep-labor-signs"] {
		t.Error("labor signs module is missing")
	}
}

func TestEveryWeekHasACard(t *testing.T) {
	for w := MinWeek; w <= MaxWeek; w++ {
		for _, role := range []string{"mother", "partner", "grandparent"} {
			c, ok := WeekCard(w, Viewer{Role: role}, 25)
			if !ok || c.WhyItMatters == "" || c.Source.URL == "" || len(c.Questions) == 0 {
				t.Fatalf("week %d (%s): incomplete card %+v", w, role, c)
			}
			if role != "grandparent" && len(c.Tasks) != 1 {
				t.Errorf("week %d (%s): want one task, got %v", w, role, c.Tasks)
			}
		}
	}
	for _, w := range []int{3, 41} {
		if _, ok := WeekCard(w, Viewer{Role: "mother"}, 25); ok {
			t.Errorf("week %d should have no card", w)
		}
	}
}

func TestTasksDifferByRole(t *testing.T) {
	m, _ := WeekCard(33, Viewer{Role: "mother"}, 33)
	p, _ := WeekCard(33, Viewer{Role: "partner"}, 33)
	if m.Tasks[0] == p.Tasks[0] {
		t.Errorf("mother and partner share a task: %q", m.Tasks[0])
	}
}

func TestBirthPrepLocksUntilWeek32(t *testing.T) {
	early, _ := WeekCard(33, Viewer{Role: "mother"}, 25)
	if len(early.BirthPrep) == 0 {
		t.Fatal("week 33 has no birth prep modules")
	}
	for _, e := range early.BirthPrep {
		if !e.Locked {
			t.Errorf("%s is open for a family at week 25", e.ID)
		}
	}
	later, _ := WeekCard(33, Viewer{Role: "mother"}, 32)
	for _, e := range later.BirthPrep {
		if e.Locked {
			t.Errorf("%s is locked for a family at week 32", e.ID)
		}
	}
	if c, _ := WeekCard(20, Viewer{Role: "mother"}, 25); len(c.BirthPrep) != 0 {
		t.Error("birth prep before week 28")
	}
}

func ids(es []Entry) map[string]bool {
	m := map[string]bool{}
	for _, e := range es {
		m[e.ID] = true
	}
	return m
}

func TestGuidesFilterByStageAndAge(t *testing.T) {
	mom := Viewer{Role: "mother"}
	planning := ids(Guides(State{Stage: "planning"}, mom, ""))
	if !planning["planning-folic-acid"] || planning["toddler-sleep"] || planning["preg-tdap"] {
		t.Errorf("planning family got %v", planning)
	}
	toddler := ids(Guides(State{Stage: "toddler", HasChild: true, AgeMonths: 24}, mom, ""))
	if !toddler["toddler-sleep"] || toddler["planning-folic-acid"] || toddler["infant-no-honey"] || toddler["school-sleep-activity"] {
		t.Errorf("toddler family got %v", toddler)
	}
	if ids(Guides(State{Stage: "toddler", HasChild: true, AgeMonths: 40}, mom, ""))["toddler-sleep"] {
		t.Error("toddler guide past its age range")
	}
}

func TestGuidesFilterByWeekAndKind(t *testing.T) {
	mom := Viewer{Role: "mother"}
	at := func(week int, kind Kind) []Entry {
		return Guides(State{Stage: "pregnancy", Week: week, HasWeek: true}, mom, kind)
	}
	if ids(at(10, ""))["preg-tdap"] || !ids(at(30, ""))["preg-tdap"] {
		t.Error("tdap guide should open at week 25 and not before")
	}
	if len(at(20, BirthPrep)) != 0 {
		t.Error("birth prep before week 28")
	}
	for _, e := range at(30, BirthPrep) {
		if e.Kind != BirthPrep || !e.Locked {
			t.Errorf("week 30 birth prep entry %s: locked=%v", e.ID, e.Locked)
		}
	}
	for _, e := range at(32, BirthPrep) {
		if e.Locked {
			t.Errorf("%s locked at week 32", e.ID)
		}
	}
	// Pregnancy stage with no due date has no week-based content.
	if n := len(Guides(State{Stage: "pregnancy"}, mom, "")); n != 0 {
		t.Errorf("got %d guides without a due date", n)
	}
}

func TestGuidesFilterByRole(t *testing.T) {
	s := State{Stage: "pregnancy", Week: 30, HasWeek: true}
	mom := ids(Guides(s, Viewer{Role: "mother"}, ""))
	partner := ids(Guides(s, Viewer{Role: "partner"}, ""))
	if !mom["preg-tdap"] || partner["preg-tdap"] {
		t.Error("tdap is for the mother only")
	}
	if mom["preg-partner-vaccines"] || !partner["preg-partner-vaccines"] {
		t.Error("partner vaccines are for the partner only")
	}
	if n := len(Guides(s, Viewer{Role: "nanny"}, "")); n != 0 {
		t.Errorf("nanny sees %d pregnancy guides", n)
	}
	if n := len(Guides(s, Viewer{Role: "grandparent"}, "")); n != 0 {
		t.Errorf("grandparent without permission sees %d pregnancy guides", n)
	}
	gp := ids(Guides(s, Viewer{Role: "grandparent", PregnancyUpdates: true}, ""))
	if len(gp) == 0 || gp["preg-tdap"] || gp["birth-prep-leave"] {
		t.Errorf("grandparent with permission got %v", gp)
	}
	toddler := State{Stage: "toddler", HasChild: true, AgeMonths: 20}
	if ids(Guides(toddler, Viewer{Role: "nanny"}, ""))["toddler-18m-visit"] {
		t.Error("nanny sees a parents-only guide")
	}
	if !ids(Guides(toddler, Viewer{Role: "nanny"}, ""))["toddler-car-seat"] {
		t.Error("nanny misses a caregiver guide")
	}
}

func TestBirthPrepIsGoneAfterBirth(t *testing.T) {
	for _, stage := range []string{"postpartum", "infant", "toddler"} {
		if n := len(Guides(State{Stage: stage, HasChild: true, AgeMonths: 1}, Viewer{Role: "mother"}, BirthPrep)); n != 0 {
			t.Errorf("%s family sees %d birth prep modules", stage, n)
		}
	}
}

func TestEveryArticleHasAnActionWithItsPayload(t *testing.T) {
	for _, g := range All() {
		if g.Kind != Article {
			if g.Action != nil {
				t.Errorf("%s: birth prep modules have no action", g.ID)
			}
			continue
		}
		a := g.Action
		if a == nil {
			t.Errorf("%s: an article needs an action", g.ID)
			continue
		}
		switch a.Kind {
		case AddTask:
			if a.Title == "" {
				t.Errorf("%s: add_task needs a title", g.ID)
			}
		case AskAtVisit:
			if a.Question == "" {
				t.Errorf("%s: ask_at_visit needs a question", g.ID)
			}
		case CommitShift:
			if a.Shift == nil || a.Shift.Title == "" || len(a.Shift.Days) == 0 || a.Shift.StartTime == "" || a.Shift.EndTime == "" {
				t.Errorf("%s: commit_shift needs a full shift", g.ID)
			}
		case Practice:
		default:
			t.Errorf("%s: unknown action kind %q", g.ID, a.Kind)
		}
	}
}

func TestEveryGuideRuleExists(t *testing.T) {
	known := map[string]bool{}
	for _, r := range rules.All() {
		known[r.ID] = true
	}
	seen := 0
	for _, g := range All() {
		if g.RuleID == "" {
			continue
		}
		seen++
		if !known[g.RuleID] {
			t.Errorf("%s names the rule %q, which does not exist in internal/rules", g.ID, g.RuleID)
		}
	}
	if seen == 0 {
		t.Error("some guides explain a plan rule")
	}
	for id := range ruleIDs { // a stale entry would silently do nothing
		found := false
		for _, g := range All() {
			found = found || g.ID == id
		}
		if !found {
			t.Errorf("ruleIDs names the guide %q, which is not in the catalog", id)
		}
	}
	for id := range actions {
		found := false
		for _, g := range All() {
			found = found || g.ID == id
		}
		if !found {
			t.Errorf("actions names the guide %q, which is not in the catalog", id)
		}
	}
}
