package money

import "github.com/unsound-mint/parenting-planner/api/internal/store"

// Suggestion is a starter line. Amounts are our rough starting points for a US family with a
// first baby, in cents. Only the delivery and childcare lines have a source for their range.
type Suggestion struct {
	Category, Name, Cadence, Payer string
	AmountCents                    int64
	Source                         *Source
}

// Starter is the catalog a family picks from. Names are the match key, so keep them stable.
var Starter = []Suggestion{
	{"pregnancy_care", "Prenatal vitamins", "monthly", "mother", 2_500, nil},
	{"pregnancy_care", "Prenatal visit copays", "once", "shared", 60_000, nil},
	{"pregnancy_care", "Childbirth class", "once", "shared", 15_000, nil},
	{"delivery", "Hospital and doctor bills (your share)", "once", "shared", 300_000, &PetersonKFF},
	{"delivery", "Newborn medical bills (your share)", "once", "shared", 50_000, &PetersonKFF},
	{"equipment", "Car seat", "once", "shared", 25_000, nil},
	{"equipment", "Crib and mattress", "once", "shared", 40_000, nil},
	{"equipment", "Stroller", "once", "shared", 35_000, nil},
	{"equipment", "Clothes and swaddles", "once", "shared", 30_000, nil},
	{"food", "Diapers and wipes", "monthly", "shared", 8_000, nil},
	{"food", "Formula or feeding supplies", "monthly", "shared", 10_000, nil},
	{"childcare", "Daycare", "monthly", "shared", 100_000, &DOLChildcare},
	{"leave", "Income lost on unpaid leave", "once", "partner", 400_000, nil},
	{"health", "Baby checkups and vaccines (copays)", "once", "shared", 30_000, nil},
}

func suggestionsFor(items []store.BudgetItem) []Suggestion {
	have := map[string]bool{}
	for _, it := range items {
		have[it.Name] = true
	}
	out := []Suggestion{}
	for _, s := range Starter {
		if !have[s.Name] {
			out = append(out, s)
		}
	}
	return out
}
