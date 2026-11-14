package rules

import "time"

// Sources for the recovery tracker. All three were opened on 2026-11-14.
// ACOG's page needs a browser-like User-Agent (plain script fetches get 402).
var (
	srcACOGPostpartum = Source{
		Title:     "ACOG Committee Opinion 736: Optimizing Postpartum Care (May 2018, reaffirmed 2025)",
		URL:       "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2018/05/optimizing-postpartum-care",
		CheckedAt: day(2026, 11, 14),
	}
	srcNHSPostnatalCheck = Source{
		Title:     "NHS: Your 6-week postnatal check",
		URL:       "https://www.nhs.uk/baby/support-and-services/your-6-week-postnatal-check/",
		CheckedAt: day(2026, 11, 14),
	}
	srcCDCWarningSigns = Source{
		Title:     "CDC Hear Her: Urgent maternal warning signs",
		URL:       "https://www.cdc.gov/hearher/maternal-warning-signs/index.html",
		CheckedAt: day(2026, 11, 14),
	}
)

// RecoveryWarningSigns are the signs a mother can tick in a check-in. Each one
// is on CDC's urgent warning sign list (heavy bleeding is "vaginal bleeding or
// discharge after pregnancy", self-harm is "thoughts about harming yourself").
var RecoveryWarningSigns = []string{"heavy_bleeding", "fever", "severe_headache", "chest_pain", "trouble_breathing", "leg_swelling_pain", "self_harm_thoughts"}

// RecoveryUrgent reports whether a check-in must send the mother to the fixed
// Urgent help screen: any ticked warning sign, or bleeding logged as heavy.
// It never says what the cause is. Source: srcCDCWarningSigns.
func RecoveryUrgent(bleeding string, signs []string) bool {
	return bleeding == "heavy" || len(signs) > 0
}

// RecoveryGuidance is the "fourth trimester" card for one point after birth.
type RecoveryGuidance struct {
	Phase    string // first_weeks, settling_in, checkup_window, later
	Headline string
	Points   []string
	Sources  []Source
}

// Days after birth that bound the postnatal check window: the NHS says 6 to 8
// weeks; ACOG says the full visit is no later than 12 weeks after birth.
const (
	PostnatalCheckOpensDay  = 42
	PostnatalCheckClosesDay = 56
	PostnatalVisitLatestDay = 84
)

// PostnatalCheck is the window for the mother's own checkup after birth.
type PostnatalCheck struct {
	Opens, Closes, Latest time.Time
	Status                string // upcoming, open, overdue
}

// PostnatalCheckWindow places the 6 to 8 week check (NHS) and the 12-week
// outer limit (ACOG) for a birth date, and says where today is relative to it.
func PostnatalCheckWindow(birth, today time.Time) PostnatalCheck {
	w := PostnatalCheck{
		Opens:  birth.AddDate(0, 0, PostnatalCheckOpensDay),
		Closes: birth.AddDate(0, 0, PostnatalCheckClosesDay),
		Latest: birth.AddDate(0, 0, PostnatalVisitLatestDay),
	}
	switch {
	case today.Before(w.Opens):
		w.Status = "upcoming"
	case !today.After(w.Closes):
		w.Status = "open"
	default:
		w.Status = "overdue"
	}
	return w
}

// FourthTrimester returns the guidance for the day after birth. The wording is
// general and never diagnoses; it tells her what the guidelines say to ask for.
// ACOG and CDC lead (the audience is the US); the NHS page is the second source
// for the 6 to 8 week checkup window.
func FourthTrimester(daysSinceBirth int) RecoveryGuidance {
	switch {
	case daysSinceBirth < 21:
		return RecoveryGuidance{
			Phase:    "first_weeks",
			Headline: "The first weeks are for healing and feeding",
			Points: []string{
				"ACOG recommends that every mother is in contact with her OB or midwife within the first 3 weeks after birth, not only at one visit weeks later.",
				"Ask about bleeding, pain, stitches or a cesarean scar, and how you are feeling. Care after birth is meant to be ongoing and fitted to you.",
				"For any warning sign on the Urgent help screen, get help right away. If something just does not feel right, say so.",
			},
			Sources: []Source{srcACOGPostpartum, srcCDCWarningSigns},
		}
	case daysSinceBirth < PostnatalCheckOpensDay:
		return RecoveryGuidance{
			Phase:    "settling_in",
			Headline: "Your own checkup is coming up",
			Points: []string{
				"A postpartum checkup around 6 to 8 weeks after birth is common. You can ask your OB or midwife for the appointment yourself, and a list of questions helps.",
				"Sleep, pain, mood and feeding all come up at that visit. Your check-ins here can go with you.",
				"Tell your provider if you feel sad or anxious. Looking after a baby can feel overwhelming, and help is available.",
			},
			Sources: []Source{srcACOGPostpartum, srcNHSPostnatalCheck},
		}
	case daysSinceBirth <= PostnatalVisitLatestDay:
		return RecoveryGuidance{
			Phase:    "checkup_window",
			Headline: "Time for your own checkup",
			Points: []string{
				"ACOG says the full postpartum visit should happen no later than 12 weeks after birth. It covers mood, sleep and fatigue, pain, feeding and contraception.",
				"The NHS lists what a 6-week check usually covers: how you feel, bleeding or discharge, stitches or a cesarean scar, ongoing pain, contraception and feeding.",
				"Mention leaking urine or stool, pain in the perineum, or pain with sex. Your provider can refer you to a pelvic floor specialist.",
			},
			Sources: []Source{srcACOGPostpartum, srcNHSPostnatalCheck},
		}
	default:
		return RecoveryGuidance{
			Phase:    "later",
			Headline: "Recovery keeps going after the first checkup",
			Points: []string{
				"ACOG describes postpartum care as an ongoing process, not a single visit. Keep telling your provider about pain, mood and sleep.",
				"You can ask your provider for help with a physical problem at any time.",
			},
			Sources: []Source{srcACOGPostpartum, srcNHSPostnatalCheck},
		}
	}
}
