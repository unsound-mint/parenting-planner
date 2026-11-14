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

func TestDemoTimeSkipNeedsSession(t *testing.T) {
	c := testutil.New(t)
	c.Post("/api/family/demo-time-skips", nil, http.StatusUnauthorized, nil)
}

// Skipping ahead moves the week, the plan and the timeline from the same
// stored data: at week 25 Tdap is upcoming, two skips later (week 27) it is due.
func TestDemoTimeSkipMovesPlanAndWeek(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	if fam.DemoDaysAhead == nil || *fam.DemoDaysAhead != 0 {
		t.Fatalf("new family demoDaysAhead = %v, want 0", fam.DemoDaysAhead)
	}
	tdap := func() (httpapi.PlanItemStatus, httpapi.Plan) {
		var pl httpapi.Plan
		c.Get("/api/members/"+mom.Id.String()+"/plan", http.StatusOK, &pl)
		for _, it := range pl.Items {
			if it.RuleId == "tdap-pregnancy" {
				return it.Status, pl
			}
		}
		t.Fatalf("no tdap-pregnancy in plan")
		return "", pl
	}
	if st, _ := tdap(); st != httpapi.PlanItemStatusUpcoming {
		t.Fatalf("week 25 tdap = %s, want upcoming", st)
	}

	var after httpapi.Family
	c.Post("/api/family/demo-time-skips", nil, http.StatusOK, &after)
	if *after.GestationalWeek != 26 || *after.DemoDaysAhead != 7 {
		t.Fatalf("after one skip: week %d, days ahead %d; want 26, 7", *after.GestationalWeek, *after.DemoDaysAhead)
	}
	var got httpapi.Family
	c.Get("/api/family", http.StatusOK, &got)
	if *got.GestationalWeek != 26 || *got.DemoDaysAhead != 7 {
		t.Fatalf("getFamily after skip: week %d, days ahead %d", *got.GestationalWeek, *got.DemoDaysAhead)
	}

	c.Post("/api/family/demo-time-skips", nil, http.StatusOK, &after)
	st, pl := tdap()
	if st != httpapi.PlanItemStatusDue {
		t.Errorf("week 27 tdap = %s, want due", st)
	}
	if want := testutil.Now.AddDate(0, 0, 14).UTC(); !pl.GeneratedAt.Equal(want) {
		t.Errorf("plan generatedAt = %s, want %s", pl.GeneratedAt, want)
	}
	var j httpapi.Journey
	c.Get("/api/members/"+mom.Id.String()+"/journey", http.StatusOK, &j)
	if j.Current.GestationalWeek == nil || *j.Current.GestationalWeek != 27 {
		t.Errorf("journey week = %v, want 27", j.Current.GestationalWeek)
	}
}

// Only the skipping family moves; starting a new demo is the reset.
func TestDemoTimeSkipIsPerFamilyAndResets(t *testing.T) {
	other := testutil.New(t)
	other.StartDemo("pregnancy")

	c := testutil.New(t)
	c.StartDemo("pregnancy")
	c.Post("/api/family/demo-time-skips", nil, http.StatusOK, nil)

	var fam httpapi.Family
	other.Get("/api/family", http.StatusOK, &fam)
	if *fam.GestationalWeek != 25 || *fam.DemoDaysAhead != 0 {
		t.Errorf("other family moved: week %d, days ahead %d", *fam.GestationalWeek, *fam.DemoDaysAhead)
	}

	// The old (skipped) cookie is still sent with this request; the new family
	// must start at the real date anyway.
	fresh := c.StartDemo("pregnancy")
	if *fresh.GestationalWeek != 25 || *fresh.DemoDaysAhead != 0 {
		t.Errorf("new demo after skip: week %d, days ahead %d; want 25, 0", *fresh.GestationalWeek, *fresh.DemoDaysAhead)
	}
	c.Get("/api/family", http.StatusOK, &fam)
	if *fam.GestationalWeek != 25 || *fam.DemoDaysAhead != 0 {
		t.Errorf("reset family: week %d, days ahead %d", *fam.GestationalWeek, *fam.DemoDaysAhead)
	}
}
