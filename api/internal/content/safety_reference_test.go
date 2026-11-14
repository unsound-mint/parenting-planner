package content

import (
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"
)

var dose = regexp.MustCompile(`(?i)\d\s?(mg|mcg|ml|tablet|capsule|pill)s?\b`)

// Every entry has a calm status, a source with a checked date and no dash;
// medicine text carries no dose and never claims safety for the reader.
func TestSafetyReferenceIsSourcedAndCalm(t *testing.T) {
	checked := time.Date(2026, time.November, 14, 0, 0, 0, 0, time.UTC)
	valid := map[SafetyStatus]bool{StatusOK: true, StatusLimit: true, StatusAvoid: true, StatusAsk: true}
	seen := map[string]bool{}
	for _, e := range SafetyReference() {
		if seen[e.ID] {
			t.Errorf("duplicate id %s", e.ID)
		}
		seen[e.ID] = true
		if e.Category != "food" && e.Category != "medicine" {
			t.Errorf("%s: category %q", e.ID, e.Category)
		}
		if e.Name == "" || e.Topic == "" || len(e.Aliases) == 0 {
			t.Errorf("%s: missing name, topic or aliases", e.ID)
		}
		if len(e.Sources) == 0 {
			t.Errorf("%s: no source", e.ID)
		}
		for _, s := range e.Sources {
			if u, err := url.Parse(s.URL); err != nil || u.Scheme != "https" || s.Title == "" || !s.CheckedAt.Equal(checked) {
				t.Errorf("%s: bad source %+v", e.ID, s)
			}
		}
		advice := []SafetyAdvice{e.Preg}
		if e.Breast != nil {
			advice = append(advice, *e.Breast)
		}
		for _, a := range advice {
			if !valid[a.Status] || a.Why == "" {
				t.Errorf("%s: bad advice %+v", e.ID, a)
			}
			low := strings.ToLower(a.Why)
			if strings.ContainsAny(a.Why, "–—") || strings.Contains(low, "safe for you") || strings.Contains(low, "you can take") {
				t.Errorf("%s: wording %q", e.ID, a.Why)
			}
			if e.Category == "medicine" && dose.MatchString(a.Why) {
				t.Errorf("%s: dose in %q", e.ID, a.Why)
			}
		}
		if (e.Category == "medicine") != (e.Ask == MedicineAsk) {
			t.Errorf("%s: ask line %q", e.ID, e.Ask)
		}
		if e.Learn != nil {
			found := false
			for _, p := range learnPaths {
				for _, l := range p.Lessons {
					found = found || (p.ID == e.Learn.PathID && l.ID == e.Learn.LessonID)
				}
			}
			if !found {
				t.Errorf("%s: learn link %+v points nowhere", e.ID, *e.Learn)
			}
		}
	}
	if len(seen) < 20 {
		t.Errorf("only %d entries", len(seen))
	}
}
