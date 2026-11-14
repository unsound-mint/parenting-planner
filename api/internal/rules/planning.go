package rules

import (
	"fmt"
	"time"
)

var (
	srcCDCFolicAcid = Source{
		Title:     "CDC: About Folic Acid",
		URL:       "https://www.cdc.gov/folic-acid/about/index.html",
		CheckedAt: day(2026, 11, 14),
	}
	srcCDCVaccinesBeforePregnancy = Source{
		Title:     "CDC: Vaccine Recommendations Before, During, and After Pregnancy",
		URL:       "https://www.cdc.gov/vaccines-pregnancy/recommended-vaccines/index.html",
		CheckedAt: day(2026, 11, 14),
	}
	srcCDCAdultNotes = Source{
		Title:     "CDC: Adult Immunization Schedule Notes, Ages 19 and Older",
		URL:       "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-notes.html",
		CheckedAt: day(2026, 11, 14),
	}
)

// Stages before a pregnancy starts.
var preconceptionStages = map[string]bool{"planning": true, "trying": true}

// tryingForABaby is true for the nudges that assume the family wants to get
// pregnant. They stay off while the family is in pregnancy loss support, which
// also sets the stage to planning.
func tryingForABaby(f Facts) bool { return preconceptionStages[f.Stage] && !f.PregnancyLoss }

// lossSuppressedPlanningRules are the planning rules tryingForABaby gates.
var lossSuppressedPlanningRules = []string{"folic-acid", "mmr-before-pregnancy"}

// PregnancyItemRuleIDs are the rules that go quiet when pregnancy loss support
// turns on: every pregnancy rule and the trying-for-a-baby nudges. Used to drop
// their unread plan_item_due notifications.
func PregnancyItemRuleIDs() []string {
	ids := append([]string{}, lossSuppressedPlanningRules...)
	for _, r := range pregnancyRules {
		ids = append(ids, r.ID)
	}
	return ids
}

const tetanusBoosterYears = 10

var planningRules = []Rule{
	{
		ID:       "folic-acid",
		Title:    "Talk to your doctor about folic acid",
		Detail:   "Guidelines suggest talking to your doctor about folic acid before you start trying and through early pregnancy. Ask your doctor what fits you.",
		Category: Learning,
		Audience: ForMother,
		Source:   srcCDCFolicAcid,
		Evaluate: func(f Facts) (Result, bool) {
			if !tryingForABaby(f) {
				return Result{}, false
			}
			return Result{Status: Due, Reason: "Because guidelines say folic acid matters most when it is started before conception, and your family is planning a pregnancy. Your doctor can tell you what fits you."}, true
		},
	},
	{
		ID:       "mmr-before-pregnancy",
		Title:    "MMR vaccine before you get pregnant",
		Detail:   "Guidelines say the MMR vaccine is not given during pregnancy, so it is planned ahead, with a wait before trying. Ask your doctor about your immunity and the timing.",
		Category: Vaccine,
		Audience: ForMother,
		Source:   srcCDCVaccinesBeforePregnancy,
		Evaluate: func(f Facts) (Result, bool) {
			if !tryingForABaby(f) || f.MotherRubella != "not immune" || f.everVaccinated(Mother, "mmr") {
				return Result{}, false
			}
			return Result{Status: Due, Reason: "Because guidelines say MMR is not given during pregnancy, and your blood test shows no immunity to rubella with no MMR on record. Your doctor can go over the timing with you."}, true
		},
	},
	{
		ID:       "tetanus-booster",
		Title:    "Tetanus booster (Td or Tdap)",
		Detail:   "Guidelines suggest a Td or Tdap booster about every 10 years. Ask your doctor or pharmacist whether you are due.",
		Category: Vaccine,
		Audience: ForBoth,
		Source:   srcCDCAdultNotes,
		Evaluate: func(f Facts) (Result, bool) {
			// During pregnancy the Tdap rules for this pregnancy apply instead.
			if f.Stage == "pregnancy" {
				return Result{}, false
			}
			last, ok := f.lastTetanusDose(f.Viewer)
			if !ok || last.After(f.Today.AddDate(-tetanusBoosterYears, 0, 0)) {
				return Result{}, false
			}
			return Result{Status: Due, Reason: fmt.Sprintf("Because guidelines suggest a booster about every %[2]d years, and your last one on record was on %[1]s. Your doctor can confirm whether you are due.", last.Format("Jan 2, 2006"), tetanusBoosterYears)}, true
		},
	},
}

// lastTetanusDose is the latest Td or Tdap on record for the parent.
func (f Facts) lastTetanusDose(r Role) (time.Time, bool) {
	var last time.Time
	found := false
	for _, v := range []string{"tdap", "td"} {
		if d, ok := f.Immunizations[r][v]; ok && (!found || d.After(last)) {
			last, found = d, true
		}
	}
	return last, found
}
