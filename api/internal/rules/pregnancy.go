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
		Detail:   "Guidelines suggest screening for gestational diabetes in the second half of pregnancy. Ask your OB when to schedule yours.",
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
				return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest gestational diabetes screening from 24 weeks, and you are %d weeks pregnant. Your OB can tell you when to schedule it.", week)}, true
			}
			return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest gestational diabetes screening between 24 and 28 weeks, and you are %d weeks pregnant with no result on file. Your OB can arrange it.", week)}, true
		},
	},
	{
		ID:       "tdap-pregnancy",
		Title:    "Tdap vaccine for this pregnancy",
		Detail:   "Guidelines suggest a Tdap (whooping cough) vaccine in each pregnancy, so the baby is born with protection. Ask your OB when it fits.",
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
				return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest Tdap from 27 weeks, and you are %d weeks pregnant. Ask your OB when to plan it.", week)}, true
			case week <= 36:
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest Tdap between 27 and 36 weeks, and you are %d weeks pregnant with none recorded for this pregnancy. Your OB can check whether it is right for you.", week)}, true
			default:
				return Result{Status: Overdue, Reason: "Because guidelines suggest Tdap between 27 and 36 weeks, and none is recorded for this pregnancy. Ask your OB whether it can still be given."}, true
			}
		},
	},
	{
		ID:       "tdap-partner",
		Title:    "Tdap vaccine before the baby arrives",
		Detail:   "Guidelines suggest Tdap for adults who will be in close contact with a newborn. Ask your doctor or pharmacist whether you need it.",
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
			return Result{Status: status, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest Tdap for adults who will be close to a newborn, and the baby is due in %d weeks with no Tdap on your record. Your doctor can check your history.", 40-week)}, true
		},
	},
	{
		ID:       "gbs-screen",
		Title:    "Group B strep test",
		Detail:   "Guidelines suggest a Group B strep swab test in late pregnancy. Ask your OB about it; they will explain what a result means for the birth.",
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
				return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest a Group B strep test at 36 to 37 weeks, and you are %d weeks pregnant. Your OB will say when to schedule it.", week)}, true
			case week <= 37:
				return Result{Status: Due, DueBy: &by, Reason: fmt.Sprintf("Because guidelines suggest a Group B strep test at 36 to 37 weeks, and you are %d weeks pregnant with no result on file. Your OB can do it at your next visit.", week)}, true
			default:
				return Result{Status: Overdue, Reason: "Because guidelines suggest a Group B strep test at 36 to 37 weeks, and no result is on file. Ask your OB about it at your next visit."}, true
			}
		},
	},
}
