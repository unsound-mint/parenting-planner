package money

import "testing"

func TestShareRespectsDeductibleCoinsuranceAndMaximum(t *testing.T) {
	a := accumulators{deductibleLeft: 200_000, oopLeft: 500_000}
	// 10,000 dollars: 2,000 deductible plus 20 percent of 8,000.
	pay, next, capped := a.share(1_000_000, 20)
	if pay != 360_000 || capped || next.deductibleLeft != 0 || next.oopLeft != 140_000 {
		t.Fatalf("pay=%d next=%+v capped=%v", pay, next, capped)
	}
	// Large bill: the maximum stops it.
	pay, next, capped = a.share(5_000_000, 20)
	if pay != 500_000 || !capped || next.oopLeft != 0 {
		t.Fatalf("pay=%d next=%+v capped=%v", pay, next, capped)
	}
}

func TestEstimateCesareanCostsMoreAndNeverPassesTheMaximum(t *testing.T) {
	in := CostInput{DeductibleCents: 300_000, OutOfPocketMaxCents: 800_000, CoinsurancePercent: 20}
	got := Estimate(in)
	if len(got) != 2 || got[0].Kind != "vaginal" || got[1].Kind != "cesarean" {
		t.Fatalf("got %+v", got)
	}
	for _, s := range got {
		if s.Total.High > in.OutOfPocketMaxCents || s.Total.Low > s.Total.High || s.Total.Low <= 0 {
			t.Errorf("%s: bad range %+v", s.Kind, s.Total)
		}
	}
	if got[1].Total.High < got[0].Total.High {
		t.Errorf("cesarean high %d below vaginal high %d", got[1].Total.High, got[0].Total.High)
	}
}

func TestPlanYearSpendingShrinksTheEstimate(t *testing.T) {
	base := CostInput{DeductibleCents: 300_000, OutOfPocketMaxCents: 800_000, CoinsurancePercent: 20}
	met := base
	met.AlreadyPaidCents = 800_000
	if got := Estimate(met)[0].Total; got.High != 0 || got.Low != 0 {
		t.Errorf("maximum already met, want zero, got %+v", got)
	}
	if Estimate(base)[0].Total.High <= 0 {
		t.Error("base estimate is zero")
	}
}

func TestZeroDeductibleFullCoverage(t *testing.T) {
	got := Estimate(CostInput{OutOfPocketMaxCents: 800_000})
	if got[0].Total.High != 0 {
		t.Errorf("0 percent coinsurance and no deductible should cost nothing, got %+v", got[0].Total)
	}
}
