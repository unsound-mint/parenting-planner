package content

import "testing"

// Every paperwork item, rights card and program carries an official page and
// a checked date, and the deadline fields agree with the basis.
func TestFamilyHubCatalog(t *testing.T) {
	h := Hub()
	if len(h.Paperwork) == 0 || len(h.Rights) == 0 || len(h.Programs) == 0 {
		t.Fatal("catalog is empty")
	}
	seen := map[string]bool{}
	for _, p := range h.Paperwork {
		if seen[p.Key] {
			t.Errorf("duplicate key %s", p.Key)
		}
		seen[p.Key] = true
		if p.Source.URL == "" || p.Source.CheckedAt.IsZero() || len(p.How) == 0 || p.Why == "" || len(p.Phases) == 0 {
			t.Errorf("%s: incomplete", p.Key)
		}
		if (p.Anchor == "") != (p.Basis == "anytime") {
			t.Errorf("%s: only an anytime item has no anchor", p.Key)
		}
		if p.Anchor != "" && p.Anchor != "due_date" && p.Anchor != "birth_date" {
			t.Errorf("%s: bad anchor", p.Key)
		}
	}
	for _, r := range h.Rights {
		if r.Source.URL == "" || r.Note.Body == "" || len(r.Ask) == 0 {
			t.Errorf("%s: incomplete", r.ID)
		}
	}
	for _, p := range h.Programs {
		if p.Source.URL == "" || len(p.Triggers) == 0 {
			t.Errorf("%s: incomplete", p.ID)
		}
		for _, tr := range p.Triggers {
			if p.Reasons[tr] == "" {
				t.Errorf("%s: no reason for %s", p.ID, tr)
			}
		}
	}
}

func TestHighlightedNeverNeedsIncomeNumbers(t *testing.T) {
	h := Hub()
	if got := h.Highlighted(map[string]bool{}, true); len(got) != 0 {
		t.Errorf("no answers must highlight nothing, got %v", got)
	}
	got := h.Highlighted(map[string]bool{"food_tight": true}, false)
	if _, ok := got["wic"]; ok {
		t.Error("WIC needs a pregnancy or a child under 5 in the household")
	}
	if _, ok := got["snap"]; !ok {
		t.Error("SNAP should be highlighted for food_tight")
	}
}
