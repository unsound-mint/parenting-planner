package rules

import (
	"fmt"
	"strings"
)

var (
	// The CDC child schedule is in flux in 2026 (see docs/guidelines/baby-0-24m.md);
	// the notes page opened shows the version updated July 1, 2025.
	srcCDCChildNotes = Source{
		Title:     "CDC: Child and Adolescent Immunization Schedule Notes (2025)",
		URL:       "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html",
		CheckedAt: day(2026, 11, 14),
	}
	srcUSPSTFVision = Source{
		Title:     "USPSTF: Vision in Children Ages 6 Months to 5 Years, Screening (2017)",
		URL:       "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/vision-in-children-ages-6-months-to-5-years-screening",
		CheckedAt: day(2026, 11, 14),
	}
)

// boosterDoses is how many doses a child should have after the 4 to 6 year visit.
var boosterDoses = []struct {
	vaccine, label string
	doses          int
}{
	{"dtap", "DTaP dose 5", 5},
	{"ipv", "polio (IPV) dose 4", 4},
	{"mmr", "MMR dose 2", 2},
	{"varicella", "chickenpox (varicella) dose 2", 2},
}

var childRules = []Rule{
	{
		ID:       "infant-2-month-vaccines",
		Title:    "Book the 2-month vaccines",
		Detail:   "Guidelines schedule the first DTaP, polio, Hib, pneumococcal and rotavirus vaccines at 2 months. Book the well visit with your pediatrician, who will go over the schedule.",
		Category: Vaccine,
		Audience: ForBoth,
		Source:   srcCDCChildNotes,
		Evaluate: func(f Facts) (Result, bool) {
			for _, c := range f.Children {
				age := c.AgeMonths(f.Today)
				days := int(f.Today.Sub(c.BirthDate).Hours() / 24)
				if days < 42 || age >= 4 || c.Doses["dtap"] > 0 {
					continue
				}
				by := c.BirthDate.AddDate(0, 2, 0)
				if f.Today.Before(by) {
					return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("Because guidelines schedule the first vaccines at 2 months, and %s is %d weeks old. Your pediatrician can book the visit.", c.Name, days/7)}, true
				}
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("Because guidelines schedule the first vaccines at 2 months, and %s is %d months old with none on record. Your pediatrician can go over the schedule.", c.Name, age)}, true
			}
			return Result{}, false
		},
	},
	{
		ID:       "preschool-boosters",
		Title:    "Vaccine boosters for ages 4 to 6",
		Detail:   "Guidelines list booster doses of DTaP, polio, MMR and chickenpox between 4 and 6 years. Ask your pediatrician at the next well visit.",
		Category: Vaccine,
		Audience: ForBoth,
		Source:   srcCDCChildNotes,
		Evaluate: func(f Facts) (Result, bool) {
			for _, c := range f.Children {
				age := c.AgeMonths(f.Today)
				if age < 48 || age >= 84 {
					continue
				}
				var missing []string
				for _, b := range boosterDoses {
					if c.Doses[b.vaccine] < b.doses {
						missing = append(missing, b.label)
					}
				}
				if len(missing) == 0 {
					continue
				}
				by := c.BirthDate.AddDate(7, 0, -1)
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("Because guidelines list boosters between 4 and 6 years, and %s is %d with these not on record yet: %s. Your pediatrician can check the record.", c.Name, age/12, strings.Join(missing, ", "))}, true
			}
			return Result{}, false
		},
	},
	{
		ID:       "vision-screen",
		Title:    "Vision check between ages 3 and 5",
		Detail:   "Guidelines suggest a vision check at least once between 3 and 5 years, to find lazy eye or its risk factors early. Ask your pediatrician at the next well visit.",
		Category: Screening,
		Audience: ForBoth,
		Source:   srcUSPSTFVision,
		Evaluate: func(f Facts) (Result, bool) {
			for _, c := range f.Children {
				age := c.AgeMonths(f.Today)
				if age < 36 || age >= 72 {
					continue
				}
				if _, done := c.Labs["vision_screen"]; done {
					continue
				}
				by := c.BirthDate.AddDate(6, 0, -1)
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest a vision check between 3 and 5 years, and %s is %d with none on file. Your pediatrician can do or arrange it.", c.Name, age/12)}, true
			}
			return Result{}, false
		},
	},
}
