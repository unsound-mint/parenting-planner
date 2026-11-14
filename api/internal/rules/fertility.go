package rules

import (
	"math"
	"sort"
	"time"
)

// Fertility estimates. These are not plan rules: they never create a plan item and
// never say anything is wrong. They turn a parent's own period days into an
// estimate of the next period and the fertile window, and tell when the
// guidelines suggest talking to a clinician. Every number is an estimate and the
// API says so.

var (
	SrcACOGFertilityAwareness = Source{
		Title:     "ACOG: Fertility Awareness-Based Methods of Family Planning",
		URL:       "https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning",
		CheckedAt: day(2026, 11, 14),
	}
	SrcACOGEvaluatingInfertility = Source{
		Title:     "ACOG: Evaluating Infertility",
		URL:       "https://www.acog.org/womens-health/faqs/evaluating-infertility",
		CheckedAt: day(2026, 11, 14),
	}
	SrcNHSTryingToGetPregnant = Source{
		Title:     "NHS: Trying to get pregnant",
		URL:       "https://www.nhs.uk/pregnancy/trying-for-a-baby/trying-to-get-pregnant/",
		CheckedAt: day(2026, 11, 14),
	}
	SrcNHSInfertility = Source{
		Title:     "NHS: Infertility",
		URL:       "https://www.nhs.uk/conditions/infertility/",
		CheckedAt: day(2026, 11, 14),
	}
	SrcMedlinePreconception = Source{
		Title:     "MedlinePlus: Preconception Care",
		URL:       "https://medlineplus.gov/preconceptioncare.html",
		CheckedAt: day(2026, 11, 14),
	}
	SrcMedlineFolicAcid = Source{
		Title:     "MedlinePlus: Folic acid in diet",
		URL:       "https://medlineplus.gov/ency/article/002408.htm",
		CheckedAt: day(2026, 11, 14),
	}
)

const (
	// ovulationBeforePeriodDays: ACOG says ovulation occurs about 14 days before the
	// next period, and that this gap is the most consistent part of the cycle.
	ovulationBeforePeriodDays = 14
	// fertileDaysBeforeOvulation and fertileDaysAfter: ACOG says you can become
	// pregnant from 5 days before ovulation until 1 day after.
	fertileDaysBeforeOvulation = 5
	fertileDaysAfterOvulation  = 1
	// A new cycle starts with the first day of bleeding. Bleeding on the days right after
	// a period day belongs to the same period.
	samePeriodGapDays = 3
	// Lengths outside this range are most likely a missed log, not a cycle, and would
	// skew the average.
	minCycleDays = 18
	maxCycleDays = 60
	// The average uses the latest cycles only.
	maxCyclesUsed = 6
	// Cycles needed before an estimate is shown.
	MinCyclesForEstimate = 2
	// Months of trying before the guidelines suggest an evaluation. ACOG: 1 year, and
	// 6 months for people older than 35. NHS: 1 year, sooner from 36.
	MonthsTryingBefore36 = 12
	MonthsTryingOver35   = 6
	OlderThanYears       = 35
)

func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// CycleStarts turns period days (not spotting) into the first day of each period.
func CycleStarts(periodDays []time.Time) []time.Time {
	days := make([]time.Time, 0, len(periodDays))
	for _, d := range periodDays {
		days = append(days, dateOnly(d))
	}
	sort.Slice(days, func(i, j int) bool { return days[i].Before(days[j]) })
	var starts []time.Time
	var prev time.Time
	for i, d := range days {
		if i == 0 || int(d.Sub(prev).Hours()/24) > samePeriodGapDays {
			starts = append(starts, d)
		}
		prev = d
	}
	return starts
}

// Cycle is one cycle: from its first day of bleeding to the day before the next one.
// Length is zero for the cycle in progress.
type Cycle struct {
	Start  time.Time
	Length int
}

// Cycles pairs each start with its length. The last one is in progress.
func Cycles(starts []time.Time) []Cycle {
	out := make([]Cycle, 0, len(starts))
	for i, s := range starts {
		c := Cycle{Start: s}
		if i+1 < len(starts) {
			c.Length = int(starts[i+1].Sub(s).Hours() / 24)
		}
		out = append(out, c)
	}
	return out
}

// Estimate is a guess, never a promise. Ready is false until MinCyclesForEstimate
// complete cycles are logged.
type Estimate struct {
	Ready        bool
	CyclesUsed   int
	CyclesNeeded int
	AverageDays  int
	ShortestDays int
	LongestDays  int
	// SpreadDays is longest minus shortest: how much the cycle moves. The window shifts
	// by about this much, so the app shows it next to the dates.
	SpreadDays    int
	NextPeriod    time.Time
	Ovulation     time.Time
	WindowStart   time.Time
	WindowEnd     time.Time
	CycleDay      int
	CycleInFlight bool
}

// EstimateFertileWindow estimates from the cycle starts logged so far. today is the
// family's today. It uses only complete cycles of a plausible length.
func EstimateFertileWindow(starts []time.Time, today time.Time) Estimate {
	today = dateOnly(today)
	var e Estimate
	if len(starts) == 0 {
		e.CyclesNeeded = MinCyclesForEstimate
		return e
	}
	last := starts[len(starts)-1]
	if !last.After(today) {
		e.CycleDay = int(today.Sub(last).Hours()/24) + 1
		e.CycleInFlight = true
	}
	var lengths []int
	for _, c := range Cycles(starts) {
		if c.Length >= minCycleDays && c.Length <= maxCycleDays {
			lengths = append(lengths, c.Length)
		}
	}
	if len(lengths) > maxCyclesUsed {
		lengths = lengths[len(lengths)-maxCyclesUsed:]
	}
	e.CyclesUsed = len(lengths)
	if len(lengths) < MinCyclesForEstimate {
		e.CyclesNeeded = MinCyclesForEstimate - len(lengths)
		return e
	}
	sum, lo, hi := 0, lengths[0], lengths[0]
	for _, l := range lengths {
		sum += l
		lo, hi = min(lo, l), max(hi, l)
	}
	e.Ready = true
	e.AverageDays = int(math.Round(float64(sum) / float64(len(lengths))))
	e.ShortestDays, e.LongestDays, e.SpreadDays = lo, hi, hi-lo
	e.NextPeriod = last.AddDate(0, 0, e.AverageDays)
	e.Ovulation = e.NextPeriod.AddDate(0, 0, -ovulationBeforePeriodDays)
	e.WindowStart = e.Ovulation.AddDate(0, 0, -fertileDaysBeforeOvulation)
	e.WindowEnd = e.Ovulation.AddDate(0, 0, fertileDaysAfterOvulation)
	return e
}

// Clinician says whether the time spent trying is long enough that ACOG and NHS
// suggest an evaluation. It never diagnoses.
type Clinician struct {
	MonthsTrying    int
	ThresholdMonths int
	Suggest         bool
}

// ClinicianAdvice: tryingSince is zero when the parent has not said. born is zero
// when unknown (treated as 35 or younger). Older than 35 means the 6 month rule,
// the wording of ACOG (NHS says "36 and over", the same people).
func ClinicianAdvice(tryingSince, born, today time.Time) Clinician {
	today = dateOnly(today)
	c := Clinician{ThresholdMonths: MonthsTryingBefore36}
	if !born.IsZero() && ageOn(born, today) > OlderThanYears {
		c.ThresholdMonths = MonthsTryingOver35
	}
	if tryingSince.IsZero() || tryingSince.After(today) {
		return c
	}
	since := dateOnly(tryingSince)
	months := (today.Year()-since.Year())*12 + int(today.Month()) - int(since.Month())
	if today.Day() < since.Day() {
		months--
	}
	c.MonthsTrying = months
	c.Suggest = months >= c.ThresholdMonths
	return c
}

func ageOn(born, on time.Time) int {
	years := on.Year() - born.Year()
	if on.Month() < born.Month() || (on.Month() == born.Month() && on.Day() < born.Day()) {
		years--
	}
	return years
}
