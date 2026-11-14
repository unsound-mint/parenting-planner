package rules

import "fmt"

var (
	srcUSPSTFPerinatalDepression = Source{
		Title:     "USPSTF: Perinatal Depression, Preventive Interventions (2019)",
		URL:       "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/perinatal-depression-preventive-interventions",
		CheckedAt: day(2026, 11, 14),
	}
	srcPSIDads = Source{
		Title:     "Postpartum Support International: Help for Dads",
		URL:       "https://www.postpartum.net/get-help/help-for-dads/",
		CheckedAt: day(2026, 11, 14),
	}
)

// Stages where perinatal mental health guidance applies.
var perinatalStages = map[string]bool{"pregnancy": true, "postpartum": true, "infant": true}

const (
	lowMoodThreshold = 2 // mood at or below this counts as a low day
	lowMoodDays      = 3 // this many low check-ins ...
	lowMoodWindow    = 7 // ... within this many days triggers the item
)

// lowMoodStreak counts the viewer's low check-ins in the window.
func lowMoodStreak(f Facts) int {
	since := f.Today.AddDate(0, 0, -lowMoodWindow)
	n := 0
	for _, m := range f.RecentMoods {
		if !m.At.Before(since) && m.Mood <= lowMoodThreshold {
			n++
		}
	}
	return n
}

func lowMoodRule(f Facts) (Result, bool) {
	if !perinatalStages[f.Stage] {
		return Result{}, false
	}
	n := lowMoodStreak(f)
	if n < lowMoodDays {
		return Result{}, false
	}
	return Result{Status: Due, Reason: fmt.Sprintf("You logged a low mood %d times in the last %d days.", n, lowMoodWindow)}, true
}

// These rules only read the viewer's own check-ins, so they never reveal
// another person's private data. They suggest talking to someone; they never
// assess or diagnose. Urgent help is a fixed screen in the UI, not a rule.
var wellbeingRules = []Rule{
	{
		ID:       "low-mood-mother",
		Title:    "Talk to someone about how you have been feeling",
		Detail:   "Several low days in a row are worth sharing with your OB, midwife or a counselor. Counseling helps prevent perinatal depression. Postpartum Support International HelpLine: call or text 1-800-944-4773.",
		Category: MentalHealth,
		Audience: ForMother,
		Source:   srcUSPSTFPerinatalDepression,
		Evaluate: lowMoodRule,
	},
	{
		ID:       "low-mood-partner",
		Title:    "Partners struggle too: talk to someone",
		Detail:   "Fathers and partners can also get depressed around a birth. Talk to your doctor or a counselor. Postpartum Support International has support for dads: call or text 1-800-944-4773.",
		Category: MentalHealth,
		Audience: ForPartner,
		Source:   srcPSIDads,
		Evaluate: lowMoodRule,
	},
}
