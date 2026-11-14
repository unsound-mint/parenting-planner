package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestFamilyNeedsSession(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/family", http.StatusUnauthorized, nil)
}

func TestUnknownTemplateIsRejected(t *testing.T) {
	c := testutil.New(t)
	c.Post("/api/demo/sessions", map[string]string{"template": "nope"}, http.StatusBadRequest, nil)
}

func TestPregnancyPlansDifferPerParent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	if fam.GestationalWeek == nil || *fam.GestationalWeek != 25 {
		t.Fatalf("want week 25, got %+v", fam.GestationalWeek)
	}
	planIDs := func(p httpapi.Parent) string {
		var pl httpapi.Plan
		c.Get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
		ids := []string{}
		for _, it := range pl.Items {
			ids = append(ids, it.RuleId)
		}
		return strings.Join(ids, ",")
	}
	if got := planIDs(testutil.Parent(t, fam, httpapi.ParentRoleMother)); got != "glucose-screen,tdap-pregnancy" {
		t.Errorf("mother plan = %s", got)
	}
	if got := planIDs(testutil.Parent(t, fam, httpapi.ParentRolePartner)); got != "tdap-partner" {
		t.Errorf("partner plan = %s", got)
	}
}

func TestOtherFamiliesAreUnreachable(t *testing.T) {
	c := testutil.New(t)
	other := c.StartDemo("pregnancy")
	c.StartDemo("pregnancy") // the client now holds the second family's session
	stranger := testutil.Parent(t, other, httpapi.ParentRoleMother)
	c.Get("/api/members/"+stranger.Id.String()+"/plan", http.StatusNotFound, nil)
	c.Get("/api/members/"+stranger.Id.String()+"/mood-checkins", http.StatusNotFound, nil)
}

func TestHealthzNeedsNoSession(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/healthz", http.StatusOK, nil)
}

// Stub until #176 lands; replace with real tests (validation, per-family storage).
func TestUpgradeIntentIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")
	c.Post("/api/family/upgrade-intents", map[string]any{"tier": "plus"}, http.StatusNotImplemented, nil)
}
