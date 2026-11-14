package rules

import "fmt"

// Childcare is logistics, not health guidance: the date comes from the
// family's own tracker. The source backs the advice in Detail ("a program
// that's convenient, open when you need it, and within your budget").
var srcChildcareGovChoosing = Source{
	Title:     "Childcare.gov: How Do I Find and Choose Quality Child Care?",
	URL:       "https://childcare.gov/consumer-education/choosing-quality-childcare",
	CheckedAt: day(2026, 11, 14),
}

const (
	childcareDueDays      = 7  // an answer due within a week is due now
	childcareUpcomingDays = 30 // further out than this stays off the plan
)

// childcareDecisionRule applies when an option the family tracks is offered
// and has a decide-by date within the next 30 days or already past. The
// earliest such date is the item's due date; once the parents mark the option
// accepted or declined, or clear the date, the item goes away.
func childcareDecisionRule(f Facts) (Result, bool) {
	var first *ChildcareOptionFacts
	open := 0
	for i, o := range f.ChildcareOptions {
		if o.Status != "offered" || o.DecideBy == nil {
			continue
		}
		open++
		if first == nil || o.DecideBy.Before(*first.DecideBy) {
			first = &f.ChildcareOptions[i]
		}
	}
	if first == nil {
		return Result{}, false
	}
	days := calendarDays(f.Today, *first.DecideBy)
	if days > childcareUpcomingDays {
		return Result{}, false
	}
	by := *first.DecideBy
	reason := fmt.Sprintf("Because %s offered you a place and asked for an answer by %s.", first.Name, by.Format("Jan 2"))
	switch open {
	case 1:
	case 2:
		reason += " Another offer is waiting for an answer too."
	default:
		reason += fmt.Sprintf(" %d other offers are waiting for an answer too.", open-1)
	}
	switch {
	case days < 0:
		return Result{Status: Overdue, DueBy: &by, Reason: reason + " If you have not answered yet, call them; the place may still be held."}, true
	case days <= childcareDueDays:
		return Result{Status: Due, DueBy: &by, Reason: reason}, true
	default:
		return Result{Status: Upcoming, DueBy: &by, Reason: reason}, true
	}
}

// childcareRules read only the family-wide childcare tracker, which both
// parents see, so both get the same item.
var childcareRules = []Rule{
	{
		ID:       "childcare-decision",
		Title:    "Decide on a childcare offer",
		Detail:   "Check that the place is convenient, open when you need it and within your budget, then accept or decline by the date they gave you. Mark the option accepted or declined in the childcare tracker.",
		Category: Logistics,
		Audience: ForBoth,
		Source:   srcChildcareGovChoosing,
		Evaluate: childcareDecisionRule,
	},
}
