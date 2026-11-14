package leave

import (
	"testing"
	"time"
)

func day(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

func byID(ps []Program, id string) (Program, bool) {
	for _, p := range ps {
		if p.ID == id {
			return p, true
		}
	}
	return Program{}, false
}

func TestEveryProgramCitesItsSource(t *testing.T) {
	for _, st := range []string{"TX", "CA", "NY", "WA"} {
		for _, p := range Programs(Answers{State: st, EmployerEmployees: 100, MonthsEmployed: 24, HoursLast12Months: 2000}) {
			if p.Source.URL == "" || p.Source.Title == "" || p.Source.CheckedAt.IsZero() || p.Reason == "" {
				t.Errorf("%s/%s lacks a source or a reason", st, p.ID)
			}
		}
	}
}

func TestFMLAEligibilityTests(t *testing.T) {
	ok := Answers{State: "TX", EmployerEmployees: 50, MonthsEmployed: 12, HoursLast12Months: 1250}
	cases := []struct {
		name string
		mod  func(*Answers)
		want Eligibility
	}{
		{"exactly at every threshold", func(*Answers) {}, Eligible},
		{"49 employees", func(a *Answers) { a.EmployerEmployees = 49 }, NotEligible},
		{"11 months", func(a *Answers) { a.MonthsEmployed = 11 }, NotEligible},
		{"1,249 hours", func(a *Answers) { a.HoursLast12Months = 1249 }, NotEligible},
		{"self-employed", func(a *Answers) { a.EmployerEmployees = 0 }, NotEligible},
	}
	for _, c := range cases {
		a := ok
		c.mod(&a)
		p, _ := byID(Programs(a), "fmla")
		if p.Eligibility != c.want {
			t.Errorf("%s: got %s, want %s (%s)", c.name, p.Eligibility, c.want, p.Reason)
		}
		if (p.Weeks != nil) != (c.want == Eligible) {
			t.Errorf("%s: weeks = %v", c.name, p.Weeks)
		}
	}
}

func TestStatePrograms(t *testing.T) {
	if _, ok := byID(Programs(Answers{State: "TX"}), "ca_pfl"); ok {
		t.Error("only CA, NY and WA have a state program here")
	}
	if p, _ := byID(Programs(Answers{State: "TX"}), "fmla"); p.Reason == "" || p.Reason[len(p.Reason)-1] == 0 {
		t.Error("an unlisted state must say that only the federal check was made")
	}
	ca, _ := byID(Programs(Answers{State: "CA", MonthsEmployed: 24, HoursLast12Months: 2000, EmployerEmployees: 100}), "ca_pfl")
	if ca.Eligibility != Unknown || *ca.Weeks != 8 {
		t.Errorf("California: earnings are not asked, so eligibility is unknown: %+v", ca)
	}
	wa := func(h int) Program {
		p, _ := byID(Programs(Answers{State: "WA", HoursLast12Months: h}), "wa_pfml")
		return p
	}
	if wa(820).Eligibility != Eligible || *wa(820).Weeks != 12 || wa(819).Eligibility != NotEligible {
		t.Error("Washington: 820 hours")
	}
	ny := func(hours, months int) Eligibility {
		p, _ := byID(Programs(Answers{State: "NY", HoursLast12Months: hours, MonthsEmployed: months}), "ny_pfl")
		return p.Eligibility
	}
	if ny(1040, 6) != Eligible || ny(1040, 5) != NotEligible || ny(500, 24) != Unknown {
		t.Error("New York: 20 hours a week and 26 weeks, else unknown for part-time")
	}
}

func TestTimelineLaysPaidThenProtectedThenNothing(t *testing.T) {
	start := day(2027, 2, 1)
	wa := Programs(Answers{State: "WA", EmployerEmployees: 200, MonthsEmployed: 36, HoursLast12Months: 2000})
	// WA: 12 weeks paid together with FMLA's 12 protected weeks, then 4 weeks with nothing.
	got := Timeline(wa, start, 16)
	if len(got) != 2 {
		t.Fatalf("segments = %+v", got)
	}
	if !got[0].Paid || !got[0].JobProtected || !got[0].StartsOn.Equal(start) || !got[0].EndsOn.Equal(day(2027, 4, 25)) {
		t.Errorf("first = %+v", got[0])
	}
	if got[1].Paid || got[1].JobProtected || !got[1].StartsOn.Equal(day(2027, 4, 26)) || len(got[1].ProgramIDs) != 0 {
		t.Errorf("second = %+v", got[1])
	}
	// FMLA alone: 12 weeks unpaid and protected.
	fm := Timeline(Programs(Answers{State: "TX", EmployerEmployees: 80, MonthsEmployed: 24, HoursLast12Months: 2000}), start, 12)
	if len(fm) != 1 || fm[0].Paid || !fm[0].JobProtected || fm[0].ProgramIDs[0] != "fmla" {
		t.Errorf("FMLA only = %+v", fm)
	}
	// Fewer weeks wanted than a program offers: the timeline stops at what was wanted.
	short := Timeline(wa, start, 6)
	if len(short) != 1 || !short[0].EndsOn.Equal(day(2027, 3, 14)) {
		t.Errorf("short = %+v", short)
	}
	// Nothing eligible: the weeks wanted are one stretch with no program.
	none := Timeline(Programs(Answers{State: "TX"}), start, 8)
	if len(none) != 1 || none[0].Paid || none[0].JobProtected || len(none[0].ProgramIDs) != 0 {
		t.Errorf("none = %+v", none)
	}
	// Segments never overlap and follow each other.
	for i := 1; i < len(got); i++ {
		if !got[i].StartsOn.Equal(got[i-1].EndsOn.AddDate(0, 0, 1)) {
			t.Errorf("gap or overlap between %d and %d", i-1, i)
		}
	}
}

func TestDeadlines(t *testing.T) {
	start := day(2027, 2, 1)
	d := Deadlines(Programs(Answers{State: "TX", EmployerEmployees: 80, MonthsEmployed: 24, HoursLast12Months: 2000}), start)
	if len(d) != 1 || !d[0].DueOn.Equal(day(2027, 1, 2)) || d[0].ProgramID != "fmla" || d[0].Source.URL == "" {
		t.Errorf("deadlines = %+v", d)
	}
	if n := len(Deadlines(Programs(Answers{State: "TX"}), start)); n != 0 {
		t.Errorf("without FMLA there is no FMLA notice deadline, got %d", n)
	}
}
