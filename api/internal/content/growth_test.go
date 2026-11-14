package content

import (
	"fmt"
	"slices"
	"strings"
	"testing"
)

func TestEveryGrowthWeekHasASourcedHotspot(t *testing.T) {
	weeks := GrowthWeeks()
	if len(weeks) != MaxWeek-3 {
		t.Fatalf("want weeks 4 to %d, got %d weeks", MaxWeek, len(weeks))
	}
	seen := map[string]int{}
	for i, w := range weeks {
		if w.Week != i+4 {
			t.Fatalf("weeks out of order: index %d is week %d", i, w.Week)
		}
		if len(w.Hotspots) == 0 {
			t.Errorf("week %d: no hotspot", w.Week)
		}
		if w.Size.LengthCm <= 0 {
			t.Errorf("week %d: no size", w.Week)
		}
		for _, h := range w.Hotspots {
			if !slices.Contains(GrowthAreas, h.Area) {
				t.Errorf("week %d: unknown area %q", w.Week, h.Area)
			}
			if h.Text == "" || strings.ContainsAny(h.Text, "—–") {
				t.Errorf("week %d: empty text or a dash in %q", w.Week, h.Text)
			}
			if h.Source.Title == "" || h.Source.CheckedAt.IsZero() {
				t.Errorf("week %d: source needs a title and checked date", w.Week)
			}
			// A hotspot paraphrases the NHS page of its own week, never a page from another week.
			if want := fmt.Sprintf("/week-%d/", w.Week); !strings.HasSuffix(h.Source.URL, want) {
				t.Errorf("week %d: cites %s, want the page ending %s", w.Week, h.Source.URL, want)
			}
			// The same sentence in two weeks reads as a bug when scrubbing.
			if prev, ok := seen[h.Text]; ok {
				t.Errorf("week %d repeats week %d: %q", w.Week, prev, h.Text)
			}
			seen[h.Text] = w.Week
		}
	}
}
