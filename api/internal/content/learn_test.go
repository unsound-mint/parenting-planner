package content

import (
	"strings"
	"testing"
)

func TestLearnCatalogIsCompleteAndSourced(t *testing.T) {
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
			if l.WeekFrom < MinWeek || l.WeekTo > MaxWeek || l.WeekFrom > l.WeekTo {
				t.Errorf("lesson %s window %d to %d", l.ID, l.WeekFrom, l.WeekTo)
			}
			if len(l.Quiz) < 2 {
				t.Errorf("lesson %s has %d quiz questions", l.ID, len(l.Quiz))
			}
			questions += len(l.Quiz)
		}
	}
	if len(learnPaths) != 8 || lessons != 32 || questions != 74 {
		t.Errorf("catalog has %d paths, %d lessons, %d questions; want 8, 32, 74", len(learnPaths), lessons, questions)
	}
}

// The MedlinePlus labor page is A.D.A.M. content that forbids derivative works;
// the labor lesson cites NICHD only.
func TestLaborLessonCitesNICHDOnly(t *testing.T) {
	if strings.Contains(string(learnPathsJSON), "medline-labor") {
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
	for stage, want := range map[string]int{"pregnancy": 32, "planning": 9, "postpartum": 19, "preschool": 3} {
		n := 0
		for _, p := range LearnPathsFor(State{Stage: stage}) {
			n += len(p.Lessons)
		}
		if n != want {
			t.Errorf("%s: %d lessons, want %d", stage, n, want)
		}
	}
	if _, ok := LessonFor(State{Stage: "preschool"}, "sharing-nights"); ok {
		t.Error("a night plan for after the birth is not for preschool parents")
	}
}
