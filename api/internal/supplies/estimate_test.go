package supplies

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// An estimate needs MinEvents logged events; fewer is no estimate, not a guess.
func TestEstimateNeedsMinEvents(t *testing.T) {
	formula := store.SupplyItem{Category: "formula", PerUse: 1}
	if _, ok := (usage{formulaFeeds: MinEvents - 1, spanDays: 1}).estimate(formula); ok {
		t.Errorf("estimate from %d formula feeds", MinEvents-1)
	}
	if got, ok := (usage{formulaFeeds: 6, spanDays: 2}).estimate(formula); !ok || got != 3 {
		t.Errorf("6 feeds over 2 days = %v %v, want 3 a day", got, ok)
	}
	if _, ok := (usage{diapers: 10, spanDays: 1}).estimate(store.SupplyItem{Category: "medicine", PerUse: 1}); ok {
		t.Error("medicine has no care-log estimate")
	}
}
