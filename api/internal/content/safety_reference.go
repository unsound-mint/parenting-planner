package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"time"
)

// safety_reference.json is the pregnancy and breastfeeding reference for
// common foods and over-the-counter medicines. It is education, not approval:
// the status is a general reading of the cited pages ("generally considered
// OK", "limit", "avoid", "ask"), never "safe for you". Every entry names the
// pages it paraphrases (opened on their checked date) and every medicine
// entry carries MedicineAsk, so the screen always ends by sending the
// question to a pharmacist or clinician. Medicine text has no doses.
//
//go:embed safety_reference.json
var safetyReferenceJSON []byte

// SafetyStatus is the calm reading of one entry.
type SafetyStatus string

const (
	StatusOK    SafetyStatus = "ok"
	StatusLimit SafetyStatus = "limit"
	StatusAvoid SafetyStatus = "avoid"
	StatusAsk   SafetyStatus = "ask"
)

// MedicineAsk ends every medicine entry.
const MedicineAsk = "Ask your pharmacist or clinician before you take it."

// SafetyAdvice is the status and the one line why for pregnancy or breastfeeding.
type SafetyAdvice struct {
	Status SafetyStatus `json:"status"`
	Why    string       `json:"why"`
}

// LearnLink points at a lesson that already covers the topic.
type LearnLink struct {
	PathID   string `json:"pathId"`
	LessonID string `json:"lessonId"`
}

// SafetyEntry is one food or medicine.
type SafetyEntry struct {
	ID        string        `json:"id"`
	Category  string        `json:"category"` // food or medicine
	Topic     string        `json:"topic"`
	Name      string        `json:"name"`
	Aliases   []string      `json:"aliases"`
	Preg      SafetyAdvice  `json:"pregnancy"`
	Breast    *SafetyAdvice `json:"breastfeeding"`
	Learn     *LearnLink    `json:"learn"`
	SourceIDs []string      `json:"sources"`
	Sources   []Source      `json:"-"`
	// Ask is MedicineAsk for medicines and empty for foods.
	Ask string `json:"-"`
}

var safetyReference = loadSafetyReference()

func loadSafetyReference() []SafetyEntry {
	var f struct {
		Sources map[string]struct{ Title, URL, CheckedAt string } `json:"sources"`
		Entries []SafetyEntry                                     `json:"entries"`
	}
	if err := json.Unmarshal(safetyReferenceJSON, &f); err != nil {
		panic(fmt.Sprintf("safety_reference.json: %v", err))
	}
	for i := range f.Entries {
		e := &f.Entries[i]
		for _, id := range e.SourceIDs {
			s, ok := f.Sources[id]
			if !ok {
				panic("safety_reference.json: unknown source " + id)
			}
			at, err := time.Parse("2006-01-02", s.CheckedAt)
			if err != nil {
				panic("safety_reference.json: bad date for " + id)
			}
			e.Sources = append(e.Sources, Source{Title: s.Title, URL: s.URL, CheckedAt: at})
		}
		if e.Category == "medicine" {
			e.Ask = MedicineAsk
		}
	}
	return f.Entries
}

// SafetyReference returns every entry in reading order. The slice is shared; do not modify it.
func SafetyReference() []SafetyEntry { return safetyReference }
