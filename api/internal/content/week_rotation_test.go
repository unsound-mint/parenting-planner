package content

import (
	"testing"
	"time"
)

// The owner's rule for This week: almost nothing stays the same from one week
// to the next. These tests walk the demo clock a week at a time and check that
// the lines meant to rotate actually do.

// The first talk prompt, the one the card shows, changes every week in every
// stage, and each stage after or before pregnancy has its own pool.
func TestTalkPromptsChangeEveryWeek(t *testing.T) {
	start := dayAt(2026, time.November, 16)
	for _, stage := range []string{"planning", "trying", "postpartum", "infant", "toddler", "preschool", "school_age"} {
		prev := ""
		for w := range 60 {
			got := CoupleTalkPrompts(State{Stage: stage}, start.AddDate(0, 0, 7*w))
			if len(got) < 2 {
				t.Fatalf("%s: %d prompts, want a pool to rotate", stage, len(got))
			}
			if got[0].ID == prev {
				t.Errorf("%s week %d: same prompt %s as the week before", stage, w, prev)
			}
			prev = got[0].ID
		}
	}
	prev := ""
	for week := 4; week <= 40; week++ {
		got := CoupleTalkPrompts(State{Stage: "pregnancy", Week: week, HasWeek: true}, start)
		if len(got) == 0 {
			t.Fatalf("pregnancy week %d: no prompts", week)
		}
		if got[0].ID == prev {
			t.Errorf("pregnancy week %d: same prompt %s as week %d", week, prev, week-1)
		}
		for _, p := range got {
			if len(p.Stages) > 0 {
				t.Errorf("pregnancy week %d: stage prompt %s", week, p.ID)
			}
		}
		prev = got[0].ID
	}
}

// The hero's "Try today" line changes every week of the preschool years and
// of the planning stages, where the headline stays for months. (Weeks of life
// 1 to 12 have a whole entry each; months 3 to 35 change monthly.)
func TestPlayIdeaChangesEveryWeekWhereTheHeadlineStays(t *testing.T) {
	birth := dayAt(2022, time.March, 9)
	from := birth.AddDate(3, 0, 0)
	prev := NowForChild(birth, from)
	for d := 7; from.AddDate(0, 0, d).Before(birth.AddDate(6, 0, 0)); d += 7 {
		l := NowForChild(birth, from.AddDate(0, 0, d))
		if l.Headline == prev.Headline && l.PlayIdea == prev.PlayIdea {
			t.Errorf("%s: same play idea two weeks running: %q", l.Period, l.PlayIdea)
		}
		prev = l
	}
	for _, stage := range []string{"planning", "trying"} {
		prevIdea := ""
		for w := range 20 {
			l, ok := NowForPlanning(stage, dayAt(2026, time.November, 16).AddDate(0, 0, 7*w))
			if !ok || l.PlayIdea == "" || l.PlayIdea == prevIdea {
				t.Errorf("%s week %d: play idea %q repeats or is missing", stage, w, l.PlayIdea)
			}
			prevIdea = l.PlayIdea
		}
	}
}
