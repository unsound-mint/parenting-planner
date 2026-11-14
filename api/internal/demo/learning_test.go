package demo

import (
	"slices"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
)

// Every seeded read, answer and talk must point at a lesson the family's stage
// offers and that is open on seed day, or the screen would show stray progress.
func TestLearnStoriesFitTheCatalog(t *testing.T) {
	states := map[Template]content.State{
		Pregnancy: {Stage: "pregnancy", Week: 25, HasWeek: true},
		Planning:  {Stage: "planning"},
		Newborn:   {Stage: "postpartum"},
		Preschool: {Stage: "preschool"},
	}
	for tmpl, story := range learnStories {
		st, ok := states[tmpl]
		if !ok {
			t.Fatalf("no state for %s", tmpl)
		}
		for _, r := range story.reads {
			l, ok := content.LessonFor(st, r.lesson)
			if !ok || l.StateOf(st).Locked {
				t.Errorf("%s: read of %s is not open in %s", tmpl, r.lesson, st.Stage)
			}
			if r.finished != 0 && r.finished < r.started {
				t.Errorf("%s: %s finished before it started", tmpl, r.lesson)
			}
		}
		for _, a := range story.answers {
			q, _, ok := content.QuestionFor(st, a.question)
			if !ok || !slices.ContainsFunc(q.Choices, func(c content.Choice) bool { return c.ID == a.choice }) {
				t.Errorf("%s: answer %s %s does not fit the catalog", tmpl, a.question, a.choice)
			}
		}
		for _, tk := range story.talks {
			if _, _, ok := content.TalkPromptText(st, tk.prompt); !ok {
				t.Errorf("%s: unknown prompt %s", tmpl, tk.prompt)
			}
		}
	}
}
