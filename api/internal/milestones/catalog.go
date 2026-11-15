// Package milestones serves the CDC "Learn the Signs. Act Early." checklist
// for a child's age and the milestones a parent ticked as seen.
package milestones

import (
	"fmt"
	"time"
)

// Item is one milestone line of a checklist.
type Item struct {
	ID, Domain, Text string
}

// CheckedAt is the day the CDC pages in catalog_data.go were opened.
var CheckedAt = time.Date(2026, 11, 15, 0, 0, 0, 0, time.UTC)

const (
	social   = "social_emotional"
	language = "language_communication"
	thinking = "cognitive"
	movement = "movement_physical"
)

// Ages are the CDC checklist ages in months, in order. Every one has a list in
// catalog (TestEveryAgeHasAChecklist).
var Ages = []int{2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60}

// ChecklistAge picks the checklist for a child of ageMonths completed months:
// the one for the age they are heading to, or the one they have just reached.
// A CDC list reads "milestones by N months", so a child of 23 months watches the
// 2 year list (not the 4 year one), a child of exactly 24 months still does, and
// at 25 months the 30 month list takes over. Past 5 years the 5 year list stays.
func ChecklistAge(ageMonths int) int {
	for _, a := range Ages {
		if ageMonths <= a {
			return a
		}
	}
	return Ages[len(Ages)-1]
}

// Checklist returns the checklist age and its items for a child's age.
func Checklist(ageMonths int) (int, []Item) {
	a := ChecklistAge(ageMonths)
	return a, catalog[a]
}

// AgeLabel names a checklist age the way the CDC pages do: "2 months", "1 year", "30 months".
func AgeLabel(months int) string {
	switch {
	case months == 12:
		return "1 year"
	case months%12 == 0:
		return fmt.Sprintf("%d years", months/12)
	}
	return fmt.Sprintf("%d months", months)
}

// SourceURL is the CDC page of a checklist age.
func SourceURL(months int) string {
	slug := fmt.Sprintf("%d-months", months)
	switch {
	case months == 12:
		slug = "1-year"
	case months%12 == 0:
		slug = fmt.Sprintf("%d-years", months/12)
	}
	return "https://www.cdc.gov/act-early/milestones/" + slug + ".html"
}

// SourceTitle is the title of a checklist age's CDC page.
func SourceTitle(months int) string {
	return "CDC: Milestones by " + AgeLabel(months)
}

// Find returns a milestone from any checklist and the checklist age it belongs to.
func Find(id string) (Item, int, bool) {
	for _, age := range Ages {
		for _, item := range catalog[age] {
			if item.ID == id {
				return item, age, true
			}
		}
	}
	return Item{}, 0, false
}
