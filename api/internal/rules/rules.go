// Package rules turns a family's facts into plan items using sourced,
// versioned guideline rules. It is pure: no I/O, no clock (Facts.Today is
// passed in), so every rule is unit-testable.
//
// Adding a rule: write it in the file for its stage, cite a source you have
// actually opened (set CheckedAt to that day), add a test, and keep the
// reason specific to the family's data. Rules never diagnose.
package rules

import (
	"sort"
	"time"
)

type Role string

const (
	Mother  Role = "mother"
	Partner Role = "partner"
)

type Audience string

const (
	ForMother  Audience = "mother"
	ForPartner Audience = "partner"
	ForBoth    Audience = "both"
)

func (a Audience) includes(r Role) bool { return a == ForBoth || string(a) == string(r) }

type Status string

const (
	Overdue  Status = "overdue"
	Due      Status = "due"
	Upcoming Status = "upcoming"
)

var statusOrder = map[Status]int{Overdue: 0, Due: 1, Upcoming: 2}

type Category string

const (
	Screening    Category = "screening"
	Vaccine      Category = "vaccine"
	Visit        Category = "visit"
	MentalHealth Category = "mental_health"
	Logistics    Category = "logistics"
	Couple       Category = "couple"
	Learning     Category = "learning"
)

type Source struct {
	Title     string
	URL       string
	CheckedAt time.Time
}

// Result is what a rule returns when it applies.
type Result struct {
	Status Status
	DueBy  *time.Time
	Reason string // why this applies to this family now, from their data
}

type Rule struct {
	ID       string
	Title    string
	Detail   string
	Category Category
	Audience Audience
	Source   Source
	// Evaluate returns ok=false when the rule does not apply right now.
	Evaluate func(f Facts) (r Result, ok bool)
}

type Item struct {
	RuleID   string
	Title    string
	Detail   string
	Category Category
	Source   Source
	Result
}

// Plan evaluates rules for the viewing parent and sorts the items by urgency.
func Plan(rs []Rule, f Facts) []Item {
	items := []Item{}
	for _, r := range rs {
		if !r.Audience.includes(f.Viewer) {
			continue
		}
		res, ok := r.Evaluate(f)
		if !ok {
			continue
		}
		items = append(items, Item{RuleID: r.ID, Title: r.Title, Detail: r.Detail, Category: r.Category, Source: r.Source, Result: res})
	}
	sort.SliceStable(items, func(i, j int) bool {
		a, b := items[i], items[j]
		if statusOrder[a.Status] != statusOrder[b.Status] {
			return statusOrder[a.Status] < statusOrder[b.Status]
		}
		if a.DueBy == nil || b.DueBy == nil {
			return a.DueBy != nil
		}
		return a.DueBy.Before(*b.DueBy)
	})
	return items
}

// All is every rule the engine knows, across stages.
func All() []Rule {
	return append([]Rule{}, pregnancyRules...)
}

func day(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }
