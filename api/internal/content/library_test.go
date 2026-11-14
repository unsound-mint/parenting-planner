package content

import (
	"regexp"
	"slices"
	"strings"
	"testing"
)

// The library is generated from the research atlas; these checks keep a rerun
// of scripts/import-atlas.py honest.
func TestLibraryTopicsAreSourcedAndLabelled(t *testing.T) {
	if len(library) < 200 {
		t.Fatalf("only %d library topics; did the import drop most of the atlas?", len(library))
	}
	seen := map[string]bool{}
	for _, tp := range library {
		if seen[tp.ID] {
			t.Errorf("duplicate id %s", tp.ID)
		}
		seen[tp.ID] = true
		if tp.Title == "" || tp.WhatToKnow == "" || tp.Category == "" || len(tp.Questions) == 0 {
			t.Errorf("%s: incomplete topic", tp.ID)
		}
		if !slices.Contains(EvidenceLabels, tp.Evidence) {
			t.Errorf("%s: evidence %q is not one of %v", tp.ID, tp.Evidence, EvidenceLabels)
		}
		if tp.From > tp.To {
			t.Errorf("%s: age span ends before it starts", tp.ID)
		}
		if len(tp.Sources) == 0 {
			t.Errorf("%s: no source", tp.ID)
		}
		for _, s := range tp.Sources {
			if s.Title == "" || !strings.HasPrefix(s.URL, "https://") || s.CheckedAt.IsZero() {
				t.Errorf("%s: bad source %+v", tp.ID, s)
			}
			if strings.Contains(s.URL, "wikipedia.org") {
				t.Errorf("%s: cites Wikipedia", tp.ID)
			}
		}
	}
	for _, tp := range library {
		for _, r := range tp.Related {
			if !seen[r] {
				t.Errorf("%s: related topic %s is not in the library", tp.ID, r)
			}
		}
	}
}

// Denis asked for these by name; they must stay findable.
func TestLibraryHasTheTopicsDenisNamed(t *testing.T) {
	for _, want := range []string{"circumcision", "bite", "crisis of 3", "oral stage", "anal stage", "braxton hicks", "breathing"} {
		found := false
		for _, tp := range library {
			text := strings.ToLower(tp.Title + " " + strings.Join(tp.Questions, " "))
			if strings.Contains(text, want) {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("no library topic mentions %q", want)
		}
	}
}

func TestLibraryPutsTheFamilysNowFirst(t *testing.T) {
	cases := []struct {
		name  string
		state State
		label string
	}{
		{"planning", State{Stage: "planning"}, "Getting ready for a baby"},
		{"trying", State{Stage: "trying"}, "Getting ready for a baby"},
		{"pregnancy week 25", State{Stage: "pregnancy", Week: 25, HasWeek: true}, "Week 25 of pregnancy"},
		{"newborn", State{Stage: "postpartum", HasChild: true, AgeMonths: 0}, "The first weeks"},
		{"infant", State{Stage: "infant", HasChild: true, AgeMonths: 7}, "7 months old"},
		{"toddler", State{Stage: "toddler", HasChild: true, AgeMonths: 30}, "2 years old"},
		{"preschool", State{Stage: "preschool", HasChild: true, AgeMonths: 50}, "4 years old"},
		{"school age", State{Stage: "school_age", HasChild: true, AgeMonths: 90}, "7 years old"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			items, label := Library(c.state)
			if label != c.label {
				t.Errorf("label = %q, want %q", label, c.label)
			}
			if len(items) != len(library) {
				t.Fatalf("got %d items, want every topic (%d)", len(items), len(library))
			}
			now := 0
			for _, e := range items {
				if e.Now {
					now++
				}
			}
			if now < 5 {
				t.Errorf("only %d topics for now", now)
			}
			// Now, then soon, then the rest.
			last := 0
			for _, e := range items {
				r := 2
				if e.Now {
					r = 0
				} else if e.Soon {
					r = 1
				}
				if r < last {
					t.Fatalf("%s is out of order", e.ID)
				}
				last = r
			}
		})
	}
}

func TestLibraryAgesReadNaturally(t *testing.T) {
	cases := []struct {
		from, to atlasAge
		want     string
	}{
		{atlasAge{"pregnancyWeek", -52}, atlasAge{"pregnancyWeek", 0}, "Before pregnancy"},
		{atlasAge{"pregnancyWeek", 24}, atlasAge{"pregnancyWeek", 28}, "Weeks 24 to 28"},
		{atlasAge{"pregnancyWeek", 36}, atlasAge{"month", 3}, "Week 36 to 3 months"},
		{atlasAge{"pregnancyWeek", 28}, atlasAge{"month", 0}, "Week 28 to birth"},
		{atlasAge{"month", 0}, atlasAge{"month", 12}, "Birth to 12 months"},
		{atlasAge{"month", 6}, atlasAge{"year", 3}, "6 months to 3 years"},
		{atlasAge{"year", 1}, atlasAge{"year", 3}, "1 to 3 years"},
	}
	for _, c := range cases {
		if got := agesLabel(c.from, c.to); got != c.want {
			t.Errorf("agesLabel(%v, %v) = %q, want %q", c.from, c.to, got, c.want)
		}
	}
}

// The app names only "your local emergency number" and 911 for the US; the
// import rewrites the NHS numbers the atlas quotes (scripts/import-atlas.py).
func TestLibraryNamesNoOtherCountrysEmergencyNumbers(t *testing.T) {
	other := regexp.MustCompile(`(^|[^\d,$])(999|111|112|103)([^\d,]|$)|A&E`)
	for _, tp := range library {
		for _, text := range libraryText(tp) {
			if m := other.FindString(text); m != "" {
				t.Errorf("%s: names %q in %q", tp.ID, m, text)
			}
		}
	}
}

// A score is never a diagnosis, and we could not open a page with the cutoffs.
func TestLibraryGivesNoEPDSCutoffs(t *testing.T) {
	cutoff := regexp.MustCompile(`(?i)(score|cut ?off)[^.]{0,30}\b\d{1,2}\b`)
	for _, tp := range library {
		all := strings.Join(libraryText(tp), " ")
		if !strings.Contains(all, "EPDS") && !strings.Contains(all, "Edinburgh") {
			continue
		}
		if m := cutoff.FindString(all); m != "" {
			t.Errorf("%s: %q reads like an EPDS cutoff", tp.ID, m)
		}
	}
}

// Where US bodies disagree the topic is labelled contested ("guidance differs")
// and cites both sides.
func TestHepatitisBBirthDoseShowsBothSides(t *testing.T) {
	tp, ok := LibraryTopicByID("hepatitis-b-birth-dose")
	if !ok {
		t.Fatal("hepatitis-b-birth-dose is missing")
	}
	if tp.Evidence != "contested" {
		t.Errorf("evidence = %s, want contested", tp.Evidence)
	}
	var cdc, other bool
	for _, s := range tp.Sources {
		cdc = cdc || strings.Contains(s.URL, "cdc.gov")
		other = other || strings.Contains(s.URL, "healthychildren.org") || strings.Contains(s.URL, "aap.org") || strings.Contains(s.URL, "who.int")
	}
	if !cdc || !other {
		t.Errorf("want CDC and AAP or WHO sources, got %+v", tp.Sources)
	}
}

func libraryText(tp LibraryTopic) []string {
	out := append([]string{tp.Title, tp.WhatToKnow, tp.AskClinicianIf, tp.EvidenceNote}, tp.Questions...)
	for _, s := range tp.WhatToDo {
		out = append(out, s.When, s.Action)
	}
	return out
}

// The library is for US families: no Kazakhstan or CIS content, US words.
// scripts/import-atlas.py drops and rewrites these; a rerun must keep it so.
func TestLibraryIsWrittenForUSFamilies(t *testing.T) {
	bad := regexp.MustCompile(`\b(Kazakh\w*|CIS|Russia\w*|labour\w*|nappy|nappies|paracetamol|antenatal\w*|colour\w*|GP)\b`)
	for _, tp := range library {
		for _, text := range libraryText(tp) {
			if m := bad.FindString(text); m != "" {
				t.Errorf("%s: %q in %q", tp.ID, m, text)
			}
		}
	}
}
