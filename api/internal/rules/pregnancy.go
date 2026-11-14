package rules

import "fmt"

var (
	srcUSPSTFGestationalDiabetes = Source{
		Title:     "USPSTF: Gestational Diabetes Screening (2021)",
		URL:       "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/gestational-diabetes-screening",
		CheckedAt: day(2026, 11, 14),
	}
	srcACOGTdap = Source{
		Title:     "ACOG Committee Opinion 718: Tdap Vaccination in Pregnancy",
		URL:       "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/09/update-on-immunization-and-pregnancy-tetanus-diphtheria-and-pertussis-vaccination",
		CheckedAt: day(2026, 11, 14),
	}
	srcACOGGBS = Source{
		Title:     "ACOG Committee Opinion 797: Prevention of Group B Streptococcal Early-Onset Disease",
		URL:       "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/02/prevention-of-group-b-streptococcal-early-onset-disease-in-newborns",
		CheckedAt: day(2026, 11, 14),
	}
)

var pregnancyRules = []Rule{
	{
		ID:       "glucose-screen",
		Title:    "Gestational diabetes screening",
		Detail:   "Ask your OB to schedule the glucose screening test. It is usually done between 24 and 28 weeks.",
		Category: Screening,
		Audience: ForMother,
		Source:   srcUSPSTFGestationalDiabetes,
		Evaluate: func(f Facts) (Result, bool) {
			week, ok := f.GestationalWeek()
			if !ok || week < 22 {
				return Result{}, false
			}
			if _, done := f.PregnancyLabs["glucose_screen"]; done {
				return Result{}, false
			}
			by := f.DateAtWeek(28)
			if week < 24 {
				return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("You are %d weeks pregnant; screening is recommended from 24 weeks.", week)}, true
			}
			return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("You are %d weeks pregnant and no glucose screening result is on file.", week)}, true
		},
	},
	{
		ID:       "tdap-pregnancy",
		Title:    "Tdap vaccine for this pregnancy",
		Detail:   "Get the Tdap (whooping cough) vaccine as early as possible between 27 and 36 weeks, so your baby is born with protection.",
		Category: Vaccine,
		Audience: ForMother,
		Source:   srcACOGTdap,
		Evaluate: func(f Facts) (Result, bool) {
			week, ok := f.GestationalWeek()
			if !ok || week < 25 {
				return Result{}, false
			}
			if f.vaccinatedSince(Mother, "tdap", f.PregnancyStart()) {
				return Result{}, false
			}
			by := f.DateAtWeek(36)
			switch {
			case week < 27:
				return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("You are %d weeks pregnant; the recommended window opens at 27 weeks.", week)}, true
			case week <= 36:
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("You are %d weeks pregnant and Tdap is not recorded for this pregnancy.", week)}, true
			default:
				return Result{Status: Overdue, Reason: "The recommended window (27 to 36 weeks) has passed without Tdap recorded. Ask your OB; it can still be given."}, true
			}
		},
	},
	{
		ID:       "tdap-partner",
		Title:    "Tdap vaccine before the baby arrives",
		Detail:   "Adults who will be in close contact with the baby and have never had Tdap should get it. Book it with your primary care doctor or a pharmacy.",
		Category: Vaccine,
		Audience: ForPartner,
		Source:   srcACOGTdap,
		Evaluate: func(f Facts) (Result, bool) {
			week, ok := f.GestationalWeek()
			if !ok || week < 20 || f.everVaccinated(Partner, "tdap") {
				return Result{}, false
			}
			by := *f.DueDate
			status := Due
			if week < 27 {
				status = Upcoming
			}
			return Result{Status: status, DueBy: &by, Reason: fmt.Sprintf("The baby is due in %d weeks and you have no Tdap on record.", 40-week)}, true
		},
	},
	{
		ID:       "gbs-screen",
		Title:    "Group B strep test",
		Detail:   "A quick swab test done between 36 and 37 weeks. If positive, you get antibiotics during labor to protect the baby.",
		Category: Screening,
		Audience: ForMother,
		Source:   srcACOGGBS,
		Evaluate: func(f Facts) (Result, bool) {
			week, ok := f.GestationalWeek()
			if !ok || week < 34 {
				return Result{}, false
			}
			if _, done := f.PregnancyLabs["gbs"]; done {
				return Result{}, false
			}
			by := f.DateAtWeek(37)
			switch {
			case week < 36:
				return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("You are %d weeks pregnant; the test is done at 36 to 37 weeks.", week)}, true
			case week <= 37:
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("You are %d weeks pregnant and no GBS result is on file.", week)}, true
			default:
				return Result{Status: Overdue, Reason: "No GBS result is on file after 37 weeks. Ask your OB about it at your next visit."}, true
			}
		},
	},
}
