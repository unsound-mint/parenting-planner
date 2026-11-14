package rules

import "fmt"

// WHO's 2022 postnatal care guidelines, as summarised in its launch news
// release (ACOG Committee Opinion 736 returned 402 and PubMed blocked the
// fetch on 2026-11-14).
var srcWHOPostnatal = Source{
	Title:     "WHO: Quality care for women and newborns in the first weeks after childbirth (postnatal care guidelines, 2022)",
	URL:       "https://www.who.int/news/item/30-03-2022-who-urges-quality-care-for-women-and-newborns-in-critical-first-weeks-after-childbirth",
	CheckedAt: day(2026, 11, 14),
}

// postpartumVisitKind is the health record kind (stored with lab results, on
// the mother) that marks the six-week checkup as done.
const postpartumVisitKind = "postpartum_visit"

// The postpartum visit window: WHO recommends a contact "during week six
// after birth" (days 35 to 41). The item stays as overdue after that until
// the baby is 12 weeks old, then drops off.
const (
	postpartumVisitOpensDay = 35
	postpartumVisitDueDay   = 41
	postpartumVisitDropDay  = 84
)

var postpartumRules = []Rule{
	{
		ID:       "postpartum-visit",
		Title:    "Your own checkup after the birth",
		Detail:   "Checkups after the birth are for you too, not only the baby. WHO recommends them at 2 to 3 days, at 1 to 2 weeks, and in the sixth week after birth. Book the six-week checkup with your OB or midwife.",
		Category: Visit,
		Audience: ForMother,
		Source:   srcWHOPostnatal,
		Evaluate: func(f Facts) (Result, bool) {
			if f.Stage != "postpartum" || len(f.Children) == 0 {
				return Result{}, false
			}
			// Children are oldest first; the newest baby is last.
			baby := f.Children[len(f.Children)-1]
			days := int(f.Today.Sub(baby.BirthDate).Hours() / 24)
			if days < 0 || days >= postpartumVisitDropDay {
				return Result{}, false
			}
			if d, ok := f.PregnancyLabs[postpartumVisitKind]; ok && !d.Before(baby.BirthDate) {
				return Result{}, false
			}
			by := baby.BirthDate.AddDate(0, 0, postpartumVisitDueDay)
			weeks := days / 7
			switch {
			case days < postpartumVisitOpensDay:
				return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("%s is %d weeks old; the checkup for you is recommended in the sixth week after birth.", baby.Name, weeks)}, true
			case days <= postpartumVisitDueDay:
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("%s is %d weeks old and no checkup for you after the birth is on record.", baby.Name, weeks)}, true
			default:
				return Result{Status: Overdue, Reason: fmt.Sprintf("%s is %d weeks old and no checkup for you after the birth is on record. If you have not had one yet, it is not too late to book it.", baby.Name, weeks)}, true
			}
		},
	},
}
