// Package paperwork lists the US paperwork a new family has to do and when.
// Deadlines are computed from the due date (before the birth) or the birth
// date (after it); they are never stored, so moving the due date moves them.
// Every item cites a page that was opened on its CheckedAt date.
package paperwork

import "time"

type Anchor string

const (
	DueDate   Anchor = "due_date"
	BirthDate Anchor = "birth_date"
)

type Source struct {
	Title     string
	URL       string
	CheckedAt time.Time
}

type Item struct {
	Key    string
	Title  string
	Detail string
	// DaysFromAnchor is added to the anchor date to get the deadline.
	DaysFromAnchor int
	Source         Source
}

var checked = time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)

// Catalog is the seeded list, in display order.
var Catalog = []Item{
	{
		Key:    "leave-notice",
		Title:  "Tell your employer you will take parental leave",
		Detail: "When the leave is foreseeable because of an expected birth, the employee must give at least 30 days' notice before it begins; if that is not practicable, as soon as practicable. The date here assumes leave starts at the due date.",
		// 30 days before the expected birth.
		DaysFromAnchor: -30,
		Source:         Source{Title: "29 CFR 825.302: Employee notice requirements for foreseeable FMLA leave", URL: "https://www.law.cornell.edu/cfr/text/29/825.302", CheckedAt: checked},
	},
	{
		Key:    "baby-health-insurance",
		Title:  "Add the baby to your health insurance",
		Detail: "On a Marketplace plan, having a baby opens a Special Enrollment Period of 60 days, and coverage can start on the day of the birth. Employer plans can have their own window: ask HR.",
		// 60 days after the birth.
		DaysFromAnchor: 60,
		Source:         Source{Title: "HealthCare.gov: Special Enrollment Period", URL: "https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/", CheckedAt: checked},
	},
	{
		Key:    "leave-bonding-window",
		Title:  "Use your bonding leave within the first year",
		Detail: "FMLA leave to care for a newborn must be taken within one year of the birth, up to 12 workweeks in a 12-month period for eligible employees.",
		// One year after the birth.
		DaysFromAnchor: 365,
		Source:         Source{Title: "U.S. Department of Labor: Family and Medical Leave Act", URL: "https://www.dol.gov/agencies/whd/fmla", CheckedAt: checked},
	},
}

type Status string

const (
	Done     Status = "done"
	Overdue  Status = "overdue"
	Due      Status = "due"
	Upcoming Status = "upcoming"
)

// DueSoonDays is how close a deadline is when the status becomes "due".
const DueSoonDays = 14

// Deadline returns the item's deadline from the anchor date.
func Deadline(it Item, anchor time.Time) time.Time {
	return anchor.AddDate(0, 0, it.DaysFromAnchor)
}

// StatusOf is "done" when ticked, otherwise by how close the deadline is.
func StatusOf(done bool, deadline, today time.Time) Status {
	switch {
	case done:
		return Done
	case deadline.Before(today):
		return Overdue
	case !deadline.After(today.AddDate(0, 0, DueSoonDays)):
		return Due
	}
	return Upcoming
}

// Anchor picks the date deadlines count from: the first child's birth date if
// the baby is born, else the due date. ok is false when neither exists.
func PickAnchor(birth *time.Time, due *time.Time) (time.Time, Anchor, bool) {
	switch {
	case birth != nil:
		return *birth, BirthDate, true
	case due != nil:
		return *due, DueDate, true
	}
	return time.Time{}, "", false
}
