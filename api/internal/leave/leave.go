// Package leave turns a parent's work answers into the parental leave programs
// they may use, a timeline and deadlines. It is pure: the answers and the dates
// come in, so every rule is unit-testable. Each program cites a page that was
// opened on its checked date; a fact the page did not state is not claimed.
package leave

import (
	"fmt"
	"sort"
	"time"
)

// Answers are one parent's wizard answers. Nothing about health.
type Answers struct {
	State             string
	EmployerEmployees int
	MonthsEmployed    int
	HoursLast12Months int
	StartsOn          *time.Time
	WeeksWanted       *int
}

type Eligibility string

const (
	Eligible    Eligibility = "eligible"
	NotEligible Eligibility = "not_eligible"
	Unknown     Eligibility = "unknown"
)

type Kind string

const (
	JobProtection Kind = "job_protection"
	PaidLeave     Kind = "paid_leave"
	Both          Kind = "both"
)

type Source struct {
	Title     string
	URL       string
	CheckedAt time.Time
}

var checked = time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)

type Program struct {
	ID          string
	Name        string
	Kind        Kind
	Eligibility Eligibility
	Weeks       *int
	Pay         string
	Reason      string
	Source      Source
}

func ip(n int) *int { return &n }

// Programs lists the programs checked for these answers: federal FMLA for
// everyone, plus the state program for CA, NY and WA.
func Programs(a Answers) []Program {
	var out []Program
	out = append(out, fmla(a))
	switch a.State {
	case "CA":
		out = append(out, californiaPFL(a))
	case "NY":
		out = append(out, newYorkPFL(a))
	case "WA":
		out = append(out, washingtonPFML(a))
	}
	return out
}

// fmla: 29 CFR 825.110(a): 12 months with the employer, 1,250 hours in the
// 12 months before leave, and a worksite with 50 or more employees within 75
// miles. The answer "people at or near the worksite" stands for the third test.
func fmla(a Answers) Program {
	p := Program{
		ID: "fmla", Name: "FMLA job-protected leave", Kind: JobProtection, Weeks: ip(12),
		Source: Source{Title: "29 CFR 825.110: Eligible employee", URL: "https://www.law.cornell.edu/cfr/text/29/825.110", CheckedAt: checked},
	}
	var missing []string
	if a.MonthsEmployed < 12 {
		missing = append(missing, fmt.Sprintf("%d months with this employer (12 needed)", a.MonthsEmployed))
	}
	if a.HoursLast12Months < 1250 {
		missing = append(missing, fmt.Sprintf("%d hours in the last 12 months (1,250 needed)", a.HoursLast12Months))
	}
	if a.EmployerEmployees < 50 {
		missing = append(missing, fmt.Sprintf("%d employees near your worksite (50 within 75 miles needed)", a.EmployerEmployees))
	}
	if len(missing) == 0 {
		p.Eligibility = Eligible
		p.Reason = "You meet the three tests: 12 months with the employer, 1,250 hours in the last 12 months, and a worksite with 50 or more employees within 75 miles."
	} else {
		p.Eligibility, p.Weeks = NotEligible, nil
		p.Reason = "Not met: " + join(missing) + "."
	}
	if a.State != "CA" && a.State != "NY" && a.State != "WA" {
		p.Reason += " Only the federal check is made for " + a.State + ": ask HR whether your state has its own program."
	}
	return p
}

// californiaPFL: the EDD page states up to 8 weeks, $50 to $1,765 a week, and
// that you need at least $300 paid into State Disability Insurance in the last
// 18 months. The answers do not include earnings, so eligibility is unknown.
func californiaPFL(Answers) Program {
	return Program{
		ID: "ca_pfl", Name: "California Paid Family Leave", Kind: PaidLeave, Eligibility: Unknown, Weeks: ip(8),
		Pay:    "Between $50 and $1,765 a week",
		Reason: "You need at least $300 earned and paid into State Disability Insurance in the last 18 months; ask HR or check with the EDD.",
		Source: Source{Title: "California EDD: Paid Family Leave", URL: "https://edd.ca.gov/en/disability/paid-family-leave/", CheckedAt: checked},
	}
}

// newYorkPFL: the NY page states eligibility after 26 consecutive weeks for a
// regular schedule of 20 or more hours a week, or after 175 days for less, and
// a maximum weekly benefit of $1,228.53. It does not state the number of weeks.
func newYorkPFL(a Answers) Program {
	p := Program{
		ID: "ny_pfl", Name: "New York Paid Family Leave", Kind: Both, Pay: "Up to $1,228.53 a week",
		Source: Source{Title: "New York Paid Family Leave", URL: "https://paidfamilyleave.ny.gov/eligibility", CheckedAt: checked},
	}
	perWeek := a.HoursLast12Months / 52
	switch {
	case perWeek >= 20 && a.MonthsEmployed >= 6:
		p.Eligibility = Eligible
		p.Reason = "You work about 20 or more hours a week and have been employed for 26 weeks or more."
	case perWeek >= 20:
		p.Eligibility = NotEligible
		p.Reason = "With a regular schedule of 20 or more hours a week you need 26 consecutive weeks of employment."
	default:
		p.Eligibility = Unknown
		p.Reason = "With a regular schedule under 20 hours a week you need to have worked 175 days; ask HR how many you have."
	}
	return p
}

// washingtonPFML: the page states 820 hours in the qualifying period and up to
// 12 weeks of leave a year.
func washingtonPFML(a Answers) Program {
	p := Program{
		ID: "wa_pfml", Name: "Washington Paid Family and Medical Leave", Kind: PaidLeave,
		Source: Source{Title: "Washington Paid Family and Medical Leave", URL: "https://paidleave.wa.gov/how-paid-leave-works/", CheckedAt: checked},
	}
	if a.HoursLast12Months >= 820 {
		p.Eligibility, p.Weeks = Eligible, ip(12)
		p.Reason = "You worked at least 820 hours; the state counts hours in its own qualifying period, which can differ from the last 12 months."
	} else {
		p.Eligibility = NotEligible
		p.Reason = fmt.Sprintf("You need at least 820 hours in the qualifying period and have %d in the last 12 months.", a.HoursLast12Months)
	}
	return p
}

func join(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += "; "
		}
		out += p
	}
	return out
}

type Segment struct {
	StartsOn, EndsOn time.Time
	ProgramIDs       []string
	Paid             bool
	JobProtected     bool
}

type Deadline struct {
	Title     string
	DueOn     time.Time
	ProgramID string
	Source    Source
}

// DefaultWeeks is how long the timeline runs when the parent did not say.
const DefaultWeeks = 12

// Timeline lays the programs on a calendar from start. First stretch: the
// weeks where an eligible paid program applies (together with FMLA when the
// parent has it); then the weeks of FMLA alone (unpaid, job-protected); then
// the rest of the weeks wanted with no program. Programs with unknown weeks
// or eligibility are listed but not placed on the timeline.
func Timeline(programs []Program, start time.Time, weeksWanted int) []Segment {
	var fmlaWeeks, paidWeeks int
	var paidIDs []string
	for _, p := range programs {
		if p.Eligibility != Eligible || p.Weeks == nil {
			continue
		}
		switch p.ID {
		case "fmla":
			fmlaWeeks = *p.Weeks
		default:
			if p.Kind != JobProtection && *p.Weeks > paidWeeks {
				paidWeeks = *p.Weeks
				paidIDs = []string{p.ID}
			}
		}
	}
	paidWeeks = min(paidWeeks, weeksWanted)
	fmlaWeeks = min(fmlaWeeks, weeksWanted)
	var out []Segment
	at := start
	add := func(weeks int, ids []string, paid, protected bool) {
		if weeks <= 0 {
			return
		}
		end := at.AddDate(0, 0, weeks*7-1)
		out = append(out, Segment{StartsOn: at, EndsOn: end, ProgramIDs: ids, Paid: paid, JobProtected: protected})
		at = end.AddDate(0, 0, 1)
	}
	both := min(paidWeeks, fmlaWeeks)
	if paidWeeks > 0 {
		ids := append([]string{}, paidIDs...)
		if both > 0 {
			add(both, append(ids, "fmla"), true, true)
		}
		add(paidWeeks-both, ids, true, false)
		fmlaWeeks -= both
	}
	if fmlaWeeks > paidWeeks-both && fmlaWeeks > 0 {
		add(fmlaWeeks, []string{"fmla"}, false, true)
	}
	if rest := weeksWanted - (paidWeeks + max(fmlaWeeks, 0)); rest > 0 {
		add(rest, []string{}, false, false)
	}
	return out
}

// Deadlines lists what to do before leave starts. The 30 days' notice of
// 29 CFR 825.302 applies to FMLA leave that is foreseeable from an expected birth.
func Deadlines(programs []Program, start time.Time) []Deadline {
	var out []Deadline
	for _, p := range programs {
		if p.ID == "fmla" && p.Eligibility == Eligible {
			out = append(out, Deadline{
				Title: "Give your employer 30 days' notice of leave", DueOn: start.AddDate(0, 0, -30), ProgramID: "fmla",
				Source: Source{Title: "29 CFR 825.302: Employee notice requirements for foreseeable FMLA leave", URL: "https://www.law.cornell.edu/cfr/text/29/825.302", CheckedAt: checked},
			})
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].DueOn.Before(out[j].DueOn) })
	return out
}
