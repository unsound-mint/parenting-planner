package money

import "time"

// CheckedAt is the day the sources below were last opened and read.
var CheckedAt = time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)

// Source is a page someone opened. The httpapi layer maps it to the contract's Source.
type Source struct {
	Title string
	URL   string
}

var (
	// PetersonKFF: Peterson-KFF Health System Tracker, published 2025-09-09, claims 2021 to 2023,
	// people with employer-sponsored insurance. Average total spending and average out-of-pocket:
	// vaginal $15,712 and $2,563; cesarean $28,998 and $3,071; newborn (first 3 months of
	// enrollment) $5,820 and $475.
	PetersonKFF = Source{
		Title: "Peterson-KFF Health System Tracker: Health costs associated with pregnancy, childbirth, and postpartum care",
		URL:   "https://www.healthsystemtracker.org/brief/health-costs-associated-with-pregnancy-childbirth-and-postpartum-care/",
	}
	// HealthCareSEP: lists "Had a baby" as a qualifying life event, coverage can start on the birth
	// date if you enroll within 60 days. The page does not list pregnancy.
	HealthCareSEP = Source{
		Title: "HealthCare.gov: Special Enrollment Period",
		URL:   "https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/",
	}
	// DOLChildcare: DOL Women's Bureau release on the National Database of Childcare Prices:
	// 2022 annual prices for one child in full-day care ranged from $6,552 to $15,600.
	DOLChildcare = Source{
		Title: "U.S. Department of Labor Women's Bureau: National Database of Childcare Prices",
		URL:   "https://www.dol.gov/index.php/newsroom/releases/wb/wb20241119",
	}
)

// Typical average totals in cents, from PetersonKFF. These are what the plan and the patient
// paid together, not what any one family will be billed.
const (
	typicalVaginal  int64 = 1_571_200
	typicalCesarean int64 = 2_899_800
	typicalNewborn  int64 = 582_000

	// The reported average out-of-pocket amounts, shown beside the estimate.
	RefOOPVaginal  int64 = 256_300
	RefOOPCesarean int64 = 307_100
	RefOOPNewborn  int64 = 47_500
)

// Our own assumption, not a number from the source: bills vary a lot, so the low end of a range
// is 70 percent of the typical total and the high end 130 percent.
const (
	lowPercent  = 70
	highPercent = 130
)

// CostInput is the family's plan.
type CostInput struct {
	DeductibleCents     int64
	OutOfPocketMaxCents int64
	CoinsurancePercent  int64
	AlreadyPaidCents    int64
}

type Range struct{ Low, High int64 }

type Scenario struct {
	Kind          string
	TypicalBilled int64
	Birth         Range
	Newborn       Range
	Total         Range
	HitsMaximum   bool
}

// accumulators carry the deductible and the out-of-pocket maximum from the birth to the newborn,
// since both count toward the same plan year.
type accumulators struct{ deductibleLeft, oopLeft int64 }

func start(in CostInput) accumulators {
	return accumulators{max(0, in.DeductibleCents-in.AlreadyPaidCents), max(0, in.OutOfPocketMaxCents-in.AlreadyPaidCents)}
}

// share is what the family pays for allowed charges of total cents: the remaining deductible first,
// then the coinsurance share, never more than what is left of the out-of-pocket maximum.
func (a accumulators) share(total int64, coinsurancePercent int64) (pay int64, next accumulators, capped bool) {
	ded := min(a.deductibleLeft, total)
	pay = ded + (total-ded)*coinsurancePercent/100
	if pay >= a.oopLeft {
		pay, capped = a.oopLeft, true
	}
	return pay, accumulators{a.deductibleLeft - ded, a.oopLeft - pay}, capped
}

func round100(c int64) int64 { return (c + 50) / 100 * 100 }

func scenario(kind string, birthTotal int64, in CostInput) Scenario {
	run := func(pct int64) (birth, newborn int64, capped bool) {
		a := start(in)
		birth, a, c1 := a.share(birthTotal*pct/100, in.CoinsurancePercent)
		newborn, _, c2 := a.share(typicalNewborn*pct/100, in.CoinsurancePercent)
		return birth, newborn, c1 || c2
	}
	lb, ln, _ := run(lowPercent)
	hb, hn, capped := run(highPercent)
	s := Scenario{
		Kind: kind, TypicalBilled: birthTotal + typicalNewborn,
		Birth: Range{round100(lb), round100(hb)}, Newborn: Range{round100(ln), round100(hn)},
		HitsMaximum: capped,
	}
	s.Total = Range{s.Birth.Low + s.Newborn.Low, s.Birth.High + s.Newborn.High}
	return s
}

// Estimate returns the vaginal and cesarean scenarios, in that order.
func Estimate(in CostInput) []Scenario {
	return []Scenario{scenario("vaginal", typicalVaginal, in), scenario("cesarean", typicalCesarean, in)}
}

// BillingLines are bills a family usually sees after a birth. Names only: no amounts, no claim
// about which are covered.
var BillingLines = []string{
	"Hospital stay (the facility bill)",
	"Delivering doctor or midwife",
	"Anesthesia, if you have it",
	"Lab work and ultrasounds",
	"The baby's care, billed on its own",
}

var Questions = []string{
	"Is our hospital in network? Are the delivering doctor and anesthesia group in network too?",
	"How much of the deductible and out-of-pocket maximum have we used this plan year?",
	"Do prenatal visits and delivery count under one maternity fee or separately?",
	"How do we add the baby to the plan, and by when?",
	"Can we ask the hospital for a cost estimate and a payment plan?",
}

const EstimateNote = "This is an estimate, not a quote. Actual charges depend on your coverage and on how the birth goes."

const EnrollmentSummary = "A birth lets you change Marketplace coverage outside open enrollment. Coverage can start on the birth date if you enroll within 60 days. Pregnancy by itself is not listed as a qualifying event."

// ChildcareBenchmark is the yearly range for full-day care of one child, per month.
const (
	ChildcareLowMonthly  int64 = 655_200 / 12
	ChildcareHighMonthly int64 = 1_560_000 / 12
)
