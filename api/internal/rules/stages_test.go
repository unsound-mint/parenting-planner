package rules

import (
	"testing"
	"time"
)

// factsAt builds facts for a non-pregnant stage with the given children.
func factsAt(stage string, viewer Role, children ...ChildFacts) Facts {
	return Facts{
		Today:         today,
		Viewer:        viewer,
		Stage:         stage,
		PregnancyLabs: map[string]time.Time{},
		Immunizations: map[Role]map[string]time.Time{Mother: {}, Partner: {}},
		CareTeam:      map[string]bool{},
		Children:      children,
	}
}

func childAged(name string, years, months, days int) ChildFacts {
	return ChildFacts{Name: name, BirthDate: today.AddDate(-years, -months, -days), Doses: map[string]int{}, Labs: map[string]time.Time{}}
}

// checkStatus fails unless the rule gives want ("" means it must not apply).
func checkStatus(t *testing.T, name, id string, f Facts, want Status) *Item {
	t.Helper()
	it := find(Plan(All(), f), id)
	switch {
	case want == "" && it != nil:
		t.Errorf("%s: %s applied (%+v), want none", name, id, it)
	case want != "" && (it == nil || it.Status != want):
		t.Errorf("%s: %s = %+v, want %s", name, id, it, want)
	}
	return it
}

func TestFolicAcid(t *testing.T) {
	checkStatus(t, "planning mother", "folic-acid", factsAt("planning", Mother), Due)
	checkStatus(t, "trying mother", "folic-acid", factsAt("trying", Mother), Due)
	checkStatus(t, "planning partner", "folic-acid", factsAt("planning", Partner), "")
	checkStatus(t, "pregnant", "folic-acid", pregnantAt(10, Mother), "")
	checkStatus(t, "preschool", "folic-acid", factsAt("preschool", Mother), "")
}

func TestMMRBeforePregnancy(t *testing.T) {
	f := factsAt("planning", Mother)
	checkStatus(t, "no lab yet", "mmr-before-pregnancy", f, "")
	f.MotherRubella = "immune"
	checkStatus(t, "immune", "mmr-before-pregnancy", f, "")
	f.MotherRubella = "not immune"
	checkStatus(t, "not immune", "mmr-before-pregnancy", f, Due)
	f.Viewer = Partner
	checkStatus(t, "partner", "mmr-before-pregnancy", f, "")
	f.Viewer = Mother
	f.Immunizations[Mother]["mmr"] = today.AddDate(0, 0, -3)
	checkStatus(t, "vaccinated", "mmr-before-pregnancy", f, "")
}

func TestTetanusBooster(t *testing.T) {
	f := factsAt("planning", Partner)
	checkStatus(t, "no record", "tetanus-booster", f, "")
	f.Immunizations[Partner]["tdap"] = today.AddDate(-9, 0, 0)
	checkStatus(t, "9 years ago", "tetanus-booster", f, "")
	f.Immunizations[Partner]["tdap"] = today.AddDate(-11, 0, 0)
	it := checkStatus(t, "11 years ago", "tetanus-booster", f, Due)
	if it != nil && it.Reason != "Your last tetanus booster on record was on Nov 14, 2015, more than 10 years ago." {
		t.Errorf("reason = %q", it.Reason)
	}
	f.Immunizations[Partner]["td"] = today.AddDate(-1, 0, 0)
	checkStatus(t, "recent td", "tetanus-booster", f, "")
	// Only the viewer's own record counts.
	f.Viewer = Mother
	checkStatus(t, "other parent", "tetanus-booster", f, "")
	p := pregnantAt(30, Mother)
	p.Immunizations[Mother]["tdap"] = today.AddDate(-11, 0, 0)
	checkStatus(t, "pregnancy", "tetanus-booster", p, "")
}

func TestInfantTwoMonthVaccines(t *testing.T) {
	checkStatus(t, "5 weeks", "infant-2-month-vaccines", factsAt("postpartum", Mother, childAged("Leo", 0, 0, 35)), "")
	it := checkStatus(t, "7 weeks", "infant-2-month-vaccines", factsAt("postpartum", Partner, childAged("Leo", 0, 0, 49)), Upcoming)
	if it != nil && (it.DueBy == nil || it.Reason != "Leo is 7 weeks old and the first vaccines are due at 2 months.") {
		t.Errorf("7 weeks: %+v", it)
	}
	checkStatus(t, "10 weeks", "infant-2-month-vaccines", factsAt("infant", Mother, childAged("Leo", 0, 2, 10)), Due)
	done := childAged("Leo", 0, 2, 10)
	done.Doses["dtap"] = 1
	checkStatus(t, "done", "infant-2-month-vaccines", factsAt("infant", Mother, done), "")
	checkStatus(t, "5 months", "infant-2-month-vaccines", factsAt("infant", Mother, childAged("Leo", 0, 5, 0)), "")
	checkStatus(t, "no children", "infant-2-month-vaccines", factsAt("planning", Mother), "")
}

func TestPreschoolBoosters(t *testing.T) {
	checkStatus(t, "3 years", "preschool-boosters", factsAt("preschool", Mother, childAged("Ava", 3, 6, 0)), "")
	ava := childAged("Ava", 4, 1, 0)
	ava.Doses = map[string]int{"dtap": 4, "ipv": 3, "mmr": 1, "varicella": 1}
	it := checkStatus(t, "4 years", "preschool-boosters", factsAt("preschool", Partner, ava), Due)
	if it != nil && it.Reason != "Ava is 4 and these doses are not on record yet: DTaP dose 5, polio (IPV) dose 4, MMR dose 2, chickenpox (varicella) dose 2." {
		t.Errorf("reason = %q", it.Reason)
	}
	ava.Doses = map[string]int{"dtap": 5, "ipv": 4, "mmr": 2, "varicella": 2}
	checkStatus(t, "done", "preschool-boosters", factsAt("preschool", Mother, ava), "")
	checkStatus(t, "7 years", "preschool-boosters", factsAt("school_age", Mother, childAged("Ava", 7, 0, 0)), "")
}

func TestVisionScreen(t *testing.T) {
	checkStatus(t, "2 years", "vision-screen", factsAt("toddler", Mother, childAged("Ava", 2, 6, 0)), "")
	checkStatus(t, "4 years", "vision-screen", factsAt("preschool", Mother, childAged("Ava", 4, 1, 0)), Due)
	done := childAged("Ava", 4, 1, 0)
	done.Labs["vision_screen"] = today.AddDate(0, -2, 0)
	checkStatus(t, "done", "vision-screen", factsAt("preschool", Partner, done), "")
	checkStatus(t, "6 years", "vision-screen", factsAt("school_age", Mother, childAged("Ava", 6, 0, 0)), "")
}
