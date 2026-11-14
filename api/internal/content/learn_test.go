package content

import (
	"slices"
	"strings"
	"testing"
)

// corePaths is learn_paths.json alone, so the counts below hold when more
// *_paths.json files join the catalog.
func corePaths(t *testing.T) ([]LearnPath, string) {
	t.Helper()
	data, err := learnPathFiles.ReadFile("learn_paths.json")
	if err != nil {
		t.Fatal(err)
	}
	return loadPathFile("learn_paths.json", data), string(data)
}

func TestLearnCatalogIsCompleteAndSourced(t *testing.T) {
	core, _ := corePaths(t)
	if len(core) != 8 {
		t.Errorf("learn_paths.json has %d paths, want 8", len(core))
	}
	lessons, questions := 0, 0
	for _, p := range learnPaths {
		if len(p.Stages) == 0 {
			t.Errorf("path %s has no stage", p.ID)
		}
		for _, l := range p.Lessons {
			lessons++
			if l.Source.URL == "" || l.Source.CheckedAt.IsZero() {
				t.Errorf("lesson %s has no source with a checked date", l.ID)
			}
			// Weeks only matter for lessons offered in pregnancy.
			inPregnancy := slices.Contains(l.Stages, "pregnancy")
			if inPregnancy && (l.WeekFrom < MinWeek || l.WeekTo > MaxWeek || l.WeekFrom > l.WeekTo) {
				t.Errorf("lesson %s window %d to %d", l.ID, l.WeekFrom, l.WeekTo)
			}
			if len(l.Quiz) < 2 {
				t.Errorf("lesson %s has %d quiz questions", l.ID, len(l.Quiz))
			}
			questions += len(l.Quiz)
		}
	}
	coreLessons, coreQuestions := 0, 0
	for _, p := range core {
		for _, l := range p.Lessons {
			coreLessons++
			coreQuestions += len(l.Quiz)
		}
	}
	if coreLessons != 32 || coreQuestions != 74 {
		t.Errorf("learn_paths.json has %d lessons, %d questions; want 32, 74", coreLessons, coreQuestions)
	}
}

// The MedlinePlus labor page is A.D.A.M. content that forbids derivative works;
// the labor lesson cites NICHD only.
func TestLaborLessonCitesNICHDOnly(t *testing.T) {
	if _, raw := corePaths(t); strings.Contains(raw, "medline-labor") {
		t.Error("learn_paths.json still cites medline-labor")
	}
	l, _ := LessonByID("how-labor-starts")
	if !strings.Contains(l.Source.URL, "nichd.nih.gov") || len(l.ExtraSources) != 0 {
		t.Errorf("how-labor-starts cites %s and %d more", l.Source.URL, len(l.ExtraSources))
	}
}

// Stored answers point at question and choice ids; they must not move.
func TestQuizIDsAreStable(t *testing.T) {
	q, ok := questionsByID["pain-relief-q1"]
	if !ok || q.LessonID != "pain-relief" || q.CorrectChoiceID != "b" || q.Choices[0].ID != "a" {
		t.Errorf("pain-relief-q1 = %+v", q)
	}
}

func TestWarningSignAndHotlineLessonsLinkToUrgentHelp(t *testing.T) {
	for _, id := range []string{"warning-signs", "where-to-call", "baby-blues", "partner-mental-health"} {
		if l, _ := LessonByID(id); !l.UrgentHelpLink {
			t.Errorf("%s must link to the fixed Urgent help screen", id)
		}
	}
}

func TestLessonStateFollowsTheWeek(t *testing.T) {
	l, _ := LessonByID("pain-relief") // window 28 to 36, opens at 24
	for _, c := range []struct {
		st     State
		timing Timing
		locked bool
	}{
		{State{Stage: "pregnancy", Week: 23, HasWeek: true}, TimingUpcoming, true},
		{State{Stage: "pregnancy", Week: 24, HasWeek: true}, TimingUpcoming, false},
		{State{Stage: "pregnancy", Week: 30, HasWeek: true}, TimingNow, false},
		{State{Stage: "pregnancy", Week: 37, HasWeek: true}, TimingPast, false},
		{State{Stage: "postpartum"}, TimingNow, false},
	} {
		if s := l.StateOf(c.st); s.Timing != c.timing || s.Locked != c.locked {
			t.Errorf("week %d %s: %+v", c.st.Week, c.st.Stage, s)
		}
	}
}

func TestTalkPromptsHaveUniqueIDs(t *testing.T) {
	if len(coupleTalkPrompts) == 0 || len(coupleTalkPromptsByID) != len(coupleTalkPrompts) {
		t.Errorf("%d prompts, %d ids", len(coupleTalkPrompts), len(coupleTalkPromptsByID))
	}
	if got := CoupleTalkPrompts(State{Stage: "pregnancy", Week: 25, HasWeek: true}); len(got) == 0 || got[0].WeekFrom < got[len(got)-1].WeekFrom {
		t.Errorf("week 25 prompts not latest-opening first: %+v", got)
	}
}

func TestLessonsFitTheirStage(t *testing.T) {
	core, _ := corePaths(t)
	isCore := map[string]bool{}
	for _, p := range core {
		isCore[p.ID] = true
	}
	for stage, want := range map[string]int{"pregnancy": 32, "planning": 9, "postpartum": 19, "preschool": 3} {
		n := 0
		for _, p := range LearnPathsFor(State{Stage: stage}) {
			if isCore[p.ID] {
				n += len(p.Lessons)
			}
		}
		if n != want {
			t.Errorf("%s: %d lessons, want %d", stage, n, want)
		}
	}
	if _, ok := LessonFor(State{Stage: "preschool"}, "sharing-nights"); ok {
		t.Error("a night plan for after the birth is not for preschool parents")
	}
}

// MedlinePlus encyclopedia pages (medlineplus.gov/ency) are A.D.A.M. content
// that forbids derivative works, so no lesson or quiz may cite one.
func TestNoLessonCitesADAMContent(t *testing.T) {
	for _, p := range learnPaths {
		for _, l := range p.Lessons {
			srcs := append([]Source{l.Source}, l.ExtraSources...)
			for _, q := range l.Quiz {
				srcs = append(srcs, q.Source)
			}
			for _, s := range srcs {
				if strings.Contains(s.URL, "medlineplus.gov/ency") {
					t.Errorf("%s cites %s", l.ID, s.URL)
				}
			}
		}
	}
}

func TestNutritionPathsJoinTheCatalog(t *testing.T) {
	for stage, want := range map[string]string{"planning": "eating-before-baby", "pregnancy": "eating-in-pregnancy", "infant": "first-foods", "preschool": "toddler-plates"} {
		found := false
		for _, p := range LearnPathsFor(State{Stage: stage}) {
			found = found || p.ID == want
		}
		if !found {
			t.Errorf("%s does not offer %s", stage, want)
		}
	}
	if _, ok := LessonFor(State{Stage: "preschool"}, "whats-in-the-cup"); ok {
		t.Error("the cup lesson is for 12 to 36 months, not preschool")
	}
	if q := questionsByID["everyday-habits-q1"]; q.Source.URL != "https://www.fda.gov/food/consumers/advice-about-eating-fish" {
		t.Errorf("fish question cites %s", q.Source.URL)
	}
}
