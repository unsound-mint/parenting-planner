package rules

import (
	"testing"
	"time"
)

func d(m time.Month, dd int) time.Time { return time.Date(2026, m, dd, 0, 0, 0, 0, time.UTC) }

func TestCycleStartsMergesDaysOfOnePeriod(t *testing.T) {
	days := []time.Time{d(1, 2), d(1, 3), d(1, 4), d(1, 5), d(1, 30), d(1, 31), d(2, 1)}
	got := CycleStarts(days)
	if len(got) != 2 || !got[0].Equal(d(1, 2)) || !got[1].Equal(d(1, 30)) {
		t.Fatalf("starts = %v", got)
	}
}

func TestEstimateNeedsTwoCompleteCycles(t *testing.T) {
	// Two starts make one complete cycle: not enough.
	e := EstimateFertileWindow([]time.Time{d(1, 1), d(1, 29)}, d(2, 5))
	if e.Ready || e.CyclesNeeded != 1 || !e.WindowStart.IsZero() {
		t.Fatalf("one cycle must not give an estimate: %+v", e)
	}
	if e := EstimateFertileWindow(nil, d(2, 5)); e.Ready || e.CyclesNeeded != MinCyclesForEstimate {
		t.Fatalf("no data: %+v", e)
	}
}

func TestEstimateFollowsAcogRules(t *testing.T) {
	// 28 day cycles: starts Jan 1, Jan 29, Feb 26. Next period Mar 26, ovulation Mar 12 (14 days before),
	// window Mar 7 (5 days before) to Mar 13 (1 day after).
	e := EstimateFertileWindow([]time.Time{d(1, 1), d(1, 29), d(2, 26)}, d(3, 1))
	if !e.Ready || e.AverageDays != 28 || e.SpreadDays != 0 {
		t.Fatalf("%+v", e)
	}
	if !e.NextPeriod.Equal(d(3, 26)) || !e.Ovulation.Equal(d(3, 12)) || !e.WindowStart.Equal(d(3, 7)) || !e.WindowEnd.Equal(d(3, 13)) {
		t.Fatalf("dates: %+v", e)
	}
	if e.CycleDay != 4 {
		t.Fatalf("cycle day = %d, want 4 (Feb 26 is day 1)", e.CycleDay)
	}
}

func TestEstimateSpreadAndImplausibleLengths(t *testing.T) {
	// 26, 31 and a 90 day gap (a missed log) that must be ignored.
	starts := []time.Time{d(1, 1), d(1, 27), d(2, 27), d(2, 27).AddDate(0, 0, 90)}
	e := EstimateFertileWindow(starts, d(6, 20))
	if e.CyclesUsed != 2 || e.ShortestDays != 26 || e.LongestDays != 31 || e.SpreadDays != 5 {
		t.Fatalf("%+v", e)
	}
}

func TestClinicianAdvice(t *testing.T) {
	today := d(11, 14)
	cases := []struct {
		name        string
		since, born time.Time
		wantMonths  int
		wantThresh  int
		wantSuggest bool
	}{
		{"not said", time.Time{}, time.Date(1995, 2, 18, 0, 0, 0, 0, time.UTC), 0, 12, false},
		{"five months, young", d(6, 14), time.Date(1995, 2, 18, 0, 0, 0, 0, time.UTC), 5, 12, false},
		{"twelve months, young", time.Date(2025, 11, 14, 0, 0, 0, 0, time.UTC), time.Date(1995, 2, 18, 0, 0, 0, 0, time.UTC), 12, 12, true},
		{"eleven months and 20 days", time.Date(2025, 11, 25, 0, 0, 0, 0, time.UTC), time.Date(1995, 2, 18, 0, 0, 0, 0, time.UTC), 11, 12, false},
		{"six months, 36", d(5, 14), time.Date(1990, 2, 18, 0, 0, 0, 0, time.UTC), 6, 6, true},
		{"six months, exactly 35", d(5, 14), time.Date(1991, 6, 1, 0, 0, 0, 0, time.UTC), 6, 12, false},
		{"unknown birth date", d(5, 14), time.Time{}, 6, 12, false},
	}
	for _, c := range cases {
		got := ClinicianAdvice(c.since, c.born, today)
		if got.MonthsTrying != c.wantMonths || got.ThresholdMonths != c.wantThresh || got.Suggest != c.wantSuggest {
			t.Errorf("%s: %+v", c.name, got)
		}
	}
}
