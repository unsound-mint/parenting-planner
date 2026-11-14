package milestones

import (
	"strings"
	"testing"
)

func TestChecklistAge(t *testing.T) {
	for _, c := range []struct{ age, want int }{
		{0, 2}, {1, 2}, {2, 2}, {3, 4}, {5, 6}, {7, 9}, {9, 9}, {10, 12}, {12, 12}, {13, 15},
		{16, 18}, {19, 24}, {23, 24}, {24, 24}, {25, 30}, {31, 36}, {37, 48}, {48, 48}, {49, 60}, {60, 60}, {100, 60},
	} {
		if got := ChecklistAge(c.age); got != c.want {
			t.Errorf("ChecklistAge(%d) = %d, want %d", c.age, got, c.want)
		}
	}
}

func TestEveryAgeHasAChecklist(t *testing.T) {
	if len(catalog) != len(Ages) {
		t.Errorf("catalog has %d ages, Ages %d", len(catalog), len(Ages))
	}
	seen := map[string]bool{}
	for _, a := range Ages {
		items := catalog[a]
		if len(items) < 8 {
			t.Errorf("%d months: %d items", a, len(items))
		}
		domains := map[string]bool{}
		for _, it := range items {
			if seen[it.ID] {
				t.Errorf("duplicate id %s", it.ID)
			}
			seen[it.ID] = true
			domains[it.Domain] = true
			if it.Text == "" || strings.Contains(strings.ToLower(it.Text), "delay") {
				t.Errorf("%s: text %q", it.ID, it.Text)
			}
		}
		if len(domains) != 4 {
			t.Errorf("%d months covers %d domains", a, len(domains))
		}
		if !strings.HasPrefix(SourceURL(a), "https://www.cdc.gov/act-early/milestones/") {
			t.Errorf("source %s", SourceURL(a))
		}
	}
	if SourceURL(12) != "https://www.cdc.gov/act-early/milestones/1-year.html" || SourceURL(30) != "https://www.cdc.gov/act-early/milestones/30-months.html" || SourceURL(48) != "https://www.cdc.gov/act-early/milestones/4-years.html" {
		t.Error("source URL pattern")
	}
}
