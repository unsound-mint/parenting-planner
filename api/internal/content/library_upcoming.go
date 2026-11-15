package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

// library_upcoming.json lists articles and quizzes we plan to write, so the
// Learn library shows its future size honestly. Each entry is a title, a
// one-line summary of what it will cover, a topic, stages and an estimate:
// never body text, because every health statement we publish must cite a page
// we opened. The web app shows them as "Coming soon" and never opens them.
// library_upcoming_test.go holds that line; the file was generated once from a
// hand-written list and is edited by hand now.
//
//go:embed library_upcoming.json
var upcomingJSON []byte

// LibraryStages are the library's stage filters in life order.
var LibraryStages = []string{"planning", "pregnancy", "newborn", "toddler", "preschool", "school"}

// UpcomingFormats are the formats a coming-soon entry can have.
var UpcomingFormats = []string{"article", "quiz"}

// UpcomingItem is one planned article or quiz. The struct has no body field on
// purpose; the loader rejects unknown fields so one cannot sneak in.
type UpcomingItem struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Summary  string   `json:"summary"`
	Category string   `json:"category"`
	Stages   []string `json:"stages"`
	Minutes  int      `json:"minutes"`
	Format   string   `json:"format"`
}

var upcoming = mustLoadUpcoming(upcomingJSON)

func mustLoadUpcoming(b []byte) []UpcomingItem {
	dec := json.NewDecoder(strings.NewReader(string(b)))
	dec.DisallowUnknownFields()
	var out []UpcomingItem
	if err := dec.Decode(&out); err != nil {
		panic(fmt.Sprintf("library_upcoming.json: %v", err))
	}
	return out
}

// Upcoming returns the planned articles and quizzes in file order.
func Upcoming() []UpcomingItem { return upcoming }

// Stage bounds on the library's age line, in months from birth (pregnancy is
// negative, conception is about 40 weeks before birth).
var stageBounds = map[string][2]float64{
	"planning":  {math.Inf(-1), -40 / weeksPerMonth},
	"pregnancy": {-40 / weeksPerMonth, 0},
	"newborn":   {0, 12},
	"toddler":   {12, 36},
	"preschool": {36, 72},
	"school":    {72, math.Inf(1)},
}

// TopicStages lists the library stages a topic's age span touches, in life order.
func TopicStages(t LibraryTopic) []string {
	out := make([]string, 0, 2)
	for _, s := range LibraryStages {
		b := stageBounds[s]
		// A span that ends exactly where a stage starts (birth) still belongs
		// to it only if it reaches inside, except for point spans.
		if t.From < b[1] && (t.To > b[0] || (t.To == b[0] && t.From == t.To)) {
			out = append(out, s)
		}
	}
	return out
}

// TopicMinutes estimates reading time from the topic's text at 200 words a minute.
func TopicMinutes(t LibraryTopic) int {
	n := len(strings.Fields(t.WhatToKnow)) + len(strings.Fields(t.AskClinicianIf))
	for _, s := range t.WhatToDo {
		n += len(strings.Fields(s.When)) + len(strings.Fields(s.Action))
	}
	return max(1, int(math.Ceil(float64(n)/200)))
}
