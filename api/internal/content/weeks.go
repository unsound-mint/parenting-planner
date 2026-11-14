package content

import (
	"fmt"
	"slices"
)

// MinWeek and MaxWeek bound the weekly card.
const (
	MinWeek = 4
	MaxWeek = 40
)

// Card is the weekly pregnancy card for one viewer.
//
// There is no baby size or development text: no source in docs/guidelines
// gives week-by-week length, weight or development, so the API omits both
// fields. Add them only with an opened source in the docs.
type Card struct {
	Week         int
	WhyItMatters string
	Tasks        []string
	Questions    []string
	BirthPrep    []Entry
	Source       Source
}

// window is a run of weeks that share one action and its source.
type window struct {
	from, to int
	// closes is the last week the action is recommended; 0 when it does not close.
	closes  int
	why     string
	mother  string
	partner string
	asks    []string
	source  Source
}

// windows cover weeks 4 to 40 with no gap; TestEveryWeekHasACard enforces it.
var windows = []window{
	{from: 4, to: 9,
		why:     "Early visits set up the tests you will need later.",
		mother:  "Book your first prenatal visit.",
		partner: "Offer to come to the first visit and put the date in the calendar.",
		asks:    []string{"Which tests will you run at the first visit?"},
		source:  srcNICHDVisits},
	{from: 10, to: 13, closes: 13,
		why:     "First-trimester screening is optional and has a narrow window.",
		mother:  "Decide on first-trimester screening or a cell-free DNA test.",
		partner: "Talk through the screening choices together before the visit.",
		asks:    []string{"Which screening options do you offer, and what does each one tell us?"},
		source:  srcMedlineDown},
	{from: 14, to: 19, closes: 20,
		why:     "A second-trimester screen is optional and works best with the first-trimester results.",
		mother:  "Decide on the quad screen, weeks 15 to 20.",
		partner: "Ask what you can do to help with the decision.",
		asks:    []string{"Would a quad screen add anything to our earlier results?"},
		source:  srcMedlineDown},
	{from: 20, to: 21,
		why:     "Knowing the warning signs now means nobody has to look them up in a hurry.",
		mother:  "Save the urgent warning signs and your provider's after-hours number.",
		partner: "Read the urgent warning signs and save the same number.",
		asks:    []string{"Which symptoms should I call about the same day?"},
		source:  srcHearHer},
	{from: 22, to: 26,
		why:     "The glucose screen is done once, at 24 weeks or later.",
		mother:  "Book the glucose test for 24 weeks or later.",
		partner: "Help find a time for the glucose test visit.",
		asks:    []string{"When should I schedule the glucose screen?"},
		source:  srcUSPSTFGDM},
	{from: 27, to: 31, closes: 36,
		why:     "Tdap in pregnancy protects the baby from whooping cough before their own shots.",
		mother:  "Get one Tdap dose, early in weeks 27 to 36.",
		partner: "Put the Tdap visit in the shared calendar.",
		asks:    []string{"Can I get Tdap at this visit?"},
		source:  srcCDCTdapPreg},
	{from: 32, to: 35, closes: 36,
		why:     "The RSV vaccine is only given in weeks 32 to 36, and only in season.",
		mother:  "Ask about the RSV vaccine; it is given weeks 32 to 36, September to January.",
		partner: "Check the RSV vaccine date with her and put it in the calendar.",
		asks:    []string{"Is the RSV vaccine right for me this season?"},
		source:  srcCDCRSV},
	{from: 36, to: 37,
		why:     "The group B strep swab is done at weeks 36 to 37 in every pregnancy.",
		mother:  "Get the group B strep swab.",
		partner: "Go with her to the swab visit and check the route to the hospital.",
		asks:    []string{"When will you do the group B strep test?"},
		source:  srcCDCGBS},
	{from: 38, to: 40,
		why:     "Labor can start any day, and the call thresholds are simple to learn.",
		mother:  "Know when to call: contractions every 5 to 10 minutes for an hour, or leaking fluid.",
		partner: "Keep the provider's number and the way to the hospital ready.",
		asks:    []string{"At what point should we leave for the hospital?"},
		source:  srcNICHDLabor},
}

// WeekCard returns the card for week and the viewer's role. familyWeek is the
// family's own completed week, which decides whether birth prep is locked.
// ok is false outside weeks 4 to 40.
func WeekCard(week int, v Viewer, familyWeek int) (Card, bool) {
	for _, w := range windows {
		if week < w.from || week > w.to {
			continue
		}
		c := Card{Week: week, WhyItMatters: w.whyFor(week), Tasks: []string{}, Questions: w.asks, BirthPrep: []Entry{}, Source: w.source}
		switch v.audience() {
		case Mother:
			c.Tasks = []string{w.mother}
		case Partner:
			c.Tasks = []string{w.partner}
		}
		if week >= 28 {
			for _, g := range guides {
				if g.Kind == BirthPrep && g.Weeks.contains(week) && slices.Contains(g.Audience, v.audience()) {
					c.BirthPrep = append(c.BirthPrep, Entry{Guide: g, Locked: familyWeek < BirthPrepUnlockWeek})
				}
			}
		}
		return c, true
	}
	return Card{}, false
}

// windowFor returns the window that covers week.
func windowFor(week int) (window, bool) {
	for _, w := range windows {
		if week >= w.from && week <= w.to {
			return w, true
		}
	}
	return window{}, false
}

// whyFor is the card's "why it matters" text for one week of the window.
func (w window) whyFor(week int) string {
	why := w.why
	if w.closes > week {
		why += fmt.Sprintf(" It closes at week %d, in %d weeks.", w.closes, w.closes-week)
	}
	return why
}
