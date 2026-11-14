package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"
	"time"
)

// The US family paperwork hub: the newborn paperwork checklist, workplace
// rights cards and benefit programs, all from official pages. family_hub.json
// holds the text; every item cites a page that was opened on checkedAt.
// Deadlines marked "official" come from the cited page; "suggested" ones are
// our own target and the screen says so; "anytime" has none.
//
//go:embed family_hub.json
var familyHubJSON []byte

// Phase is where a family stands for paperwork: before the birth, with a baby
// under a year, or later.
type Phase string

const (
	PhaseBefore  Phase = "before"
	PhaseNewborn Phase = "newborn"
	PhaseLater   Phase = "later"
)

// PhaseOf maps a family stage to its paperwork phase.
func PhaseOf(stage string) Phase {
	switch stage {
	case "planning", "trying", "pregnancy":
		return PhaseBefore
	case "postpartum", "infant":
		return PhaseNewborn
	}
	return PhaseLater
}

type PaperworkItem struct {
	Key, Title, Short, Why string
	Phases                 []Phase
	Anchor                 string // due_date, birth_date or empty
	Offset                 int
	Basis                  string // official, suggested, anytime
	How                    []string
	Source                 Source
	More                   []Source
}

// AppliesTo reports whether the item belongs on the checklist in this phase.
func (p PaperworkItem) AppliesTo(ph Phase) bool { return slices.Contains(p.Phases, ph) }

type RightsNote struct{ Subject, Body string }

type RightsCard struct {
	ID, Title, Law, Covers, HowToAsk string
	Ask                              []string
	Note                             RightsNote
	Source                           Source
}

type StatePointer struct {
	Title, Text string
	Source      Source
}

type BenefitQuestion struct{ ID, Text string }

type BenefitProgram struct {
	ID, Name, What, Where string
	Triggers              []string
	Reasons               map[string]string
	// NeedsHousehold: only offered when the household has a pregnancy or a child under 5.
	NeedsHousehold bool
	Source         Source
	More           []Source
}

type BenefitFinder struct {
	Text   string
	Source Source
}

type FamilyHub struct {
	CheckedAt time.Time
	Paperwork []PaperworkItem
	Rights    []RightsCard
	State     StatePointer
	Questions []BenefitQuestion
	Programs  []BenefitProgram
	Finder    BenefitFinder
}

var familyHub = loadFamilyHub()

// Hub returns the catalog. Callers must not change it.
func Hub() *FamilyHub { return familyHub }

// PaperworkByKey finds a checklist item.
func PaperworkByKey(key string) (PaperworkItem, bool) {
	for _, p := range familyHub.Paperwork {
		if p.Key == key {
			return p, true
		}
	}
	return PaperworkItem{}, false
}

// Highlighted lists the programs worth a look for these yes answers, with the
// first reason for each. It never says anyone qualifies: eligibility is the
// agency's decision. household is true for a pregnancy or a child under 5.
func (h *FamilyHub) Highlighted(yes map[string]bool, household bool) map[string]string {
	out := map[string]string{}
	for _, p := range h.Programs {
		if p.NeedsHousehold && !household {
			continue
		}
		for _, t := range p.Triggers {
			if yes[t] {
				out[p.ID] = p.Reasons[t]
				break
			}
		}
	}
	return out
}

type rawSource struct{ Title, URL string }

func loadFamilyHub() *FamilyHub {
	var raw struct {
		CheckedAt string               `json:"checkedAt"`
		Sources   map[string]rawSource `json:"sources"`
		Paperwork []struct {
			Key, Title, Short, Why string
			Phases                 []Phase
			Anchor                 string
			Offset                 int
			Basis                  string
			How                    []string
			Source                 string
			More                   []string
		} `json:"paperwork"`
		Rights []struct {
			ID, Title, Law, Covers, HowToAsk string
			Ask                              []string
			Note                             RightsNote
			Source                           string
		} `json:"rights"`
		StatePointer struct{ Title, Text, Source string } `json:"statePointer"`
		Benefits     struct {
			Questions []BenefitQuestion `json:"questions"`
			Programs  []struct {
				ID, Name, What, Where string
				Triggers              []string
				Reasons               map[string]string
				NeedsHousehold        bool
				Source                string
				More                  []string
			} `json:"programs"`
			Finder struct{ Text, Source string } `json:"finder"`
		} `json:"benefits"`
	}
	if err := json.Unmarshal(familyHubJSON, &raw); err != nil {
		panic(fmt.Errorf("family_hub.json: %w", err))
	}
	checked, err := time.Parse(time.DateOnly, raw.CheckedAt)
	if err != nil {
		panic(fmt.Errorf("family_hub.json checkedAt: %w", err))
	}
	src := func(id string) Source {
		s, ok := raw.Sources[id]
		if !ok {
			panic(fmt.Errorf("family_hub.json: unknown source %q", id))
		}
		return Source{Title: s.Title, URL: s.URL, CheckedAt: checked}
	}
	srcs := func(ids []string) []Source {
		out := make([]Source, 0, len(ids))
		for _, id := range ids {
			out = append(out, src(id))
		}
		return out
	}
	h := &FamilyHub{CheckedAt: checked, Questions: raw.Benefits.Questions}
	for _, p := range raw.Paperwork {
		h.Paperwork = append(h.Paperwork, PaperworkItem{Key: p.Key, Title: p.Title, Short: p.Short, Why: p.Why, Phases: p.Phases,
			Anchor: p.Anchor, Offset: p.Offset, Basis: p.Basis, How: p.How, Source: src(p.Source), More: srcs(p.More)})
	}
	for _, r := range raw.Rights {
		h.Rights = append(h.Rights, RightsCard{ID: r.ID, Title: r.Title, Law: r.Law, Covers: r.Covers, HowToAsk: r.HowToAsk, Ask: r.Ask, Note: r.Note, Source: src(r.Source)})
	}
	h.State = StatePointer{Title: raw.StatePointer.Title, Text: raw.StatePointer.Text, Source: src(raw.StatePointer.Source)}
	for _, p := range raw.Benefits.Programs {
		h.Programs = append(h.Programs, BenefitProgram{ID: p.ID, Name: p.Name, What: p.What, Where: p.Where, Triggers: p.Triggers, Reasons: p.Reasons,
			NeedsHousehold: p.NeedsHousehold, Source: src(p.Source), More: srcs(p.More)})
	}
	h.Finder = BenefitFinder{Text: raw.Benefits.Finder.Text, Source: src(raw.Benefits.Finder.Source)}
	return h
}
