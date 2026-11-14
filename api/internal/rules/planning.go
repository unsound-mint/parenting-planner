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

const tetanusBoosterYears = 10

var planningRules = []Rule{
	{
		ID:       "folic-acid",
		Title:    "Start folic acid before trying",
		Detail:   "Take 400 micrograms of folic acid every day, starting at least one month before you try to get pregnant and continuing through pregnancy.",
		Category: Learning,
		Audience: ForMother,
		Source:   srcCDCFolicAcid,
		Evaluate: func(f Facts) (Result, bool) {
			if !preconceptionStages[f.Stage] {
				return Result{}, false
			}
			return Result{Status: Due, Reason: "Your family is planning a pregnancy, and folic acid works best when it is started at least a month before conception."}, true
		},
	},
	{
		ID:       "mmr-before-pregnancy",
		Title:    "MMR vaccine before you get pregnant",
		Detail:   "The MMR vaccine cannot be given during pregnancy, so get it now. Wait one month after the shot, and until a blood test confirms you are immune, before trying to get pregnant.",
		Category: Vaccine,
		Audience: ForMother,
		Source:   srcCDCVaccinesBeforePregnancy,
		Evaluate: func(f Facts) (Result, bool) {
			if !preconceptionStages[f.Stage] || f.MotherRubella != "not immune" || f.everVaccinated(Mother, "mmr") {
				return Result{}, false
			}
			return Result{Status: Due, Reason: "Your preconception blood test shows you are not immune to rubella, and no MMR vaccine is on record."}, true
		},
	},
	{
		ID:       "tetanus-booster",
		Title:    "Tetanus booster (Td or Tdap)",
		Detail:   "Adults need a Td or Tdap booster every 10 years. Your primary care doctor or a pharmacy can give it.",
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
			return Result{Status: Due, Reason: fmt.Sprintf("Your last tetanus booster on record was on %s, more than %d years ago.", last.Format("Jan 2, 2006"), tetanusBoosterYears)}, true
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
