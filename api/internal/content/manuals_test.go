package content

import (
	"net/url"
	"strings"
	"testing"
)

// Every manual is sourced, every step drawable and short, and every
// self-check question has exactly one valid answer among its choices.
func TestManualsAreSourcedAndCheckable(t *testing.T) {
	seen := map[string]bool{}
	for _, m := range Manuals() {
		if seen[m.ID] || m.ID == "" || m.Title == "" || m.Summary == "" || m.Minutes <= 0 {
			t.Errorf("%q: duplicate id or missing title, summary or minutes", m.ID)
		}
		seen[m.ID] = true
		if len(m.Sources) == 0 {
			t.Errorf("%s: no source", m.ID)
		}
		for _, s := range m.Sources {
			if u, err := url.Parse(s.URL); err != nil || u.Scheme != "https" || s.Title == "" || s.CheckedAt.IsZero() {
				t.Errorf("%s: bad source %+v", m.ID, s)
			}
		}
		if len(m.Steps) < 3 {
			t.Errorf("%s: fewer than 3 steps", m.ID)
		}
		for i, st := range m.Steps {
			if st.Scene == "" || st.Title == "" || st.Text == "" || len(st.Text) > 200 {
				t.Errorf("%s step %d: missing scene, title or text, or text too long", m.ID, i)
			}
			if strings.Contains(st.Text+st.Watch, "—") {
				t.Errorf("%s step %d: em dash", m.ID, i)
			}
		}
		if len(m.Check) < 2 {
			t.Errorf("%s: fewer than 2 self-check questions", m.ID)
		}
		for _, q := range m.Check {
			ok := false
			for _, c := range q.Choices {
				ok = ok || c.ID == q.Correct
			}
			if !ok || len(q.Choices) < 2 {
				t.Errorf("%s/%s: correct choice missing", m.ID, q.ID)
			}
		}
	}
	for _, id := range []string{"swaddle", "burp", "safe-sleep"} {
		if _, ok := ManualByID(id); !ok {
			t.Errorf("manual %s missing", id)
		}
	}
}
