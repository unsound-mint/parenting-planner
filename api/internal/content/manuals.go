package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"time"
)

// manuals.json holds the hands-on care manuals of the Practice tab (swaddle,
// burp, safe sleep). Sources are kept here for the footer sources page; the
// manual screens do not show them.
//
//go:embed manuals.json
var manualsJSON []byte

type ManualStep struct {
	Scene string `json:"scene"`
	Title string `json:"title"`
	Text  string `json:"text"`
	Watch string `json:"watch"`
}

type ManualCheck struct {
	ID      string           `json:"id"`
	Prompt  string           `json:"prompt"`
	Choices []PracticeChoice `json:"choices"`
	Correct string           `json:"correct"`
}

type Manual struct {
	ID        string        `json:"id"`
	Title     string        `json:"title"`
	Summary   string        `json:"summary"`
	Minutes   int           `json:"minutes"`
	Steps     []ManualStep  `json:"steps"`
	Check     []ManualCheck `json:"check"`
	SourceIDs []string      `json:"sources"`
	Sources   []Source      `json:"-"`
}

var manuals = loadManuals()

func loadManuals() []Manual {
	var f struct {
		Sources map[string]struct{ Title, URL, CheckedAt string } `json:"sources"`
		Manuals []Manual                                          `json:"manuals"`
	}
	if err := json.Unmarshal(manualsJSON, &f); err != nil {
		panic(fmt.Sprintf("manuals.json: %v", err))
	}
	for i := range f.Manuals {
		m := &f.Manuals[i]
		for _, id := range m.SourceIDs {
			s, ok := f.Sources[id]
			if !ok {
				panic("manuals.json: unknown source " + id)
			}
			at, err := time.Parse("2006-01-02", s.CheckedAt)
			if err != nil {
				panic("manuals.json: bad date for " + id)
			}
			m.Sources = append(m.Sources, Source{Title: s.Title, URL: s.URL, CheckedAt: at})
		}
	}
	return f.Manuals
}

// Manuals returns every manual in display order. The slice is shared; do not modify it.
func Manuals() []Manual { return manuals }

// ManualByID returns one manual, or false when the id is unknown.
func ManualByID(id string) (Manual, bool) {
	for _, m := range manuals {
		if m.ID == id {
			return m, true
		}
	}
	return Manual{}, false
}
