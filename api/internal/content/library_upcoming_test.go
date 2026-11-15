package content

import (
	"slices"
	"strings"
	"testing"
)

// Coming-soon entries are placeholders, not guidance: no body text, a short
// summary and a modest count, so the library never pretends to hold unsourced
// health advice or grows into an endless list.
func TestUpcomingEntriesCarryNoBodyText(t *testing.T) {
	if n := len(Upcoming()); n < 50 || n > 300 {
		t.Fatalf("%d coming-soon entries; keep the catalogue deliberate (50 to 300)", n)
	}
	if strings.Contains(string(upcomingJSON), `"body"`) {
		t.Fatal(`library_upcoming.json has a "body" field; coming-soon entries never carry body text`)
	}
	seen := map[string]bool{}
	for _, u := range Upcoming() {
		if seen[u.ID] || libraryByID[u.ID].ID != "" {
			t.Errorf("%s: duplicate id", u.ID)
		}
		seen[u.ID] = true
		if u.Title == "" || u.Category == "" || u.Summary == "" {
			t.Errorf("%s: incomplete entry", u.ID)
		}
		if len(strings.Fields(u.Summary)) > 20 || strings.Count(u.Summary, ".") > 1 {
			t.Errorf("%s: summary is more than one short line", u.ID)
		}
		if !slices.Contains(UpcomingFormats, u.Format) {
			t.Errorf("%s: format %q", u.ID, u.Format)
		}
		if u.Minutes < 1 || u.Minutes > 20 {
			t.Errorf("%s: %d minutes", u.ID, u.Minutes)
		}
		if len(u.Stages) == 0 {
			t.Errorf("%s: no stage", u.ID)
		}
		for _, s := range u.Stages {
			if !slices.Contains(LibraryStages, s) {
				t.Errorf("%s: stage %q", u.ID, s)
			}
		}
	}
}

func TestUpcomingLoaderRejectsABody(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("an entry with a body loaded")
		}
	}()
	mustLoadUpcoming([]byte(`[{"id":"x","title":"x","summary":"x","category":"health","stages":["newborn"],"minutes":3,"format":"article","body":"text"}]`))
}

func TestEveryTopicHasAStageAndMinutes(t *testing.T) {
	for _, tp := range library {
		if len(TopicStages(tp)) == 0 {
			t.Errorf("%s (%s): no stage", tp.ID, tp.Ages)
		}
		if TopicMinutes(tp) < 1 {
			t.Errorf("%s: no reading time", tp.ID)
		}
	}
}
