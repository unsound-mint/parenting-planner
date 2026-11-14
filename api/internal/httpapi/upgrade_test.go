package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

const upgradePath = "/api/family/upgrade-intents"

func TestUpgradeIntentValidation(t *testing.T) {
	c := testutil.New(t)
	c.Post(upgradePath, httpapi.UpgradeIntentInput{Tier: httpapi.PaidTierPlus}, http.StatusUnauthorized, nil)

	c.StartDemo("pregnancy")
	c.Post(upgradePath, map[string]any{"tier": "free"}, http.StatusBadRequest, nil)
	c.Post(upgradePath, map[string]any{"tier": "gold"}, http.StatusBadRequest, nil)
	c.Post(upgradePath, map[string]any{}, http.StatusBadRequest, nil)
}

func TestUpgradeIntentIsStoredPerFamily(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	if fam.Tier == nil || *fam.Tier != httpapi.TierFree || fam.UpgradeRequest != nil {
		t.Fatalf("new family: tier %v, upgrade request %+v; want free and none", fam.Tier, fam.UpgradeRequest)
	}

	var got httpapi.UpgradeIntent
	c.Post(upgradePath, httpapi.UpgradeIntentInput{Tier: httpapi.PaidTierPlus}, http.StatusCreated, &got)
	if got.Tier != httpapi.PaidTierPlus || !got.RequestedAt.Equal(testutil.Now) {
		t.Errorf("created %+v, want plus at %v", got, testutil.Now)
	}

	// A second request replaces the first; the tier itself stays free (no billing).
	c.Post(upgradePath, httpapi.UpgradeIntentInput{Tier: httpapi.PaidTierConcierge}, http.StatusCreated, nil)
	c.Get("/api/family", http.StatusOK, &fam)
	if fam.UpgradeRequest == nil || fam.UpgradeRequest.Tier != httpapi.PaidTierConcierge {
		t.Errorf("family upgrade request = %+v, want concierge", fam.UpgradeRequest)
	}
	if fam.Tier == nil || *fam.Tier != httpapi.TierFree {
		t.Errorf("tier = %v, want free", fam.Tier)
	}
	var n int
	if err := c.Pool.QueryRow(t.Context(), "SELECT count(*) FROM upgrade_intents WHERE family_id = $1", fam.Id).Scan(&n); err != nil || n != 1 {
		t.Errorf("upgrade_intents rows = %d (err %v), want 1", n, err)
	}

	// Another family does not see it.
	other := c.StartDemo("pregnancy")
	if other.UpgradeRequest != nil {
		t.Errorf("other family sees upgrade request %+v", other.UpgradeRequest)
	}
}
