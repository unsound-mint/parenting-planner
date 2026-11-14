package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func getPlan(c *testutil.Client, p httpapi.Parent) httpapi.Plan {
	var pl httpapi.Plan
	c.Get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
	return pl
}

func statusPath(p httpapi.Parent, ruleID string) string {
	return "/api/members/" + p.Id.String() + "/plan/" + ruleID + "/status"
}

func progressOf(t *testing.T, pl httpapi.Plan, ruleID string) string {
	t.Helper()
	for _, it := range pl.Items {
		if it.RuleId == ruleID {
			if it.Progress == nil {
				return ""
			}
			return string(*it.Progress)
		}
	}
	t.Fatalf("%s is not on the plan", ruleID)
	return ""
}

func TestPlanItemProgressShowsOnThePlan(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	before := getPlan(c, mom)
	if len(before.Items) == 0 {
		t.Fatal("the pregnancy demo mother has an empty plan")
	}
	for _, it := range before.Items {
		if it.Progress != nil {
			t.Fatalf("%s has progress %s before anything was recorded", it.RuleId, *it.Progress)
		}
	}
	rule := before.Items[0].RuleId

	var got httpapi.PlanItem
	c.Put(statusPath(mom, rule), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressBooked}, http.StatusOK, &got)
	if got.RuleId != rule || got.Progress == nil || *got.Progress != httpapi.PlanItemProgressBooked {
		t.Fatalf("PUT returned %+v, want %s booked", got, rule)
	}
	after := getPlan(c, mom)
	if p := progressOf(t, after, rule); p != "booked" {
		t.Errorf("plan shows %q for %s, want booked", p, rule)
	}
	// A settled item stays on the plan, in the same place, with the same status.
	if len(after.Items) != len(before.Items) || after.Items[0].RuleId != rule || after.Items[0].Status != before.Items[0].Status {
		t.Errorf("recording progress changed the plan: before %+v, after %+v", before.Items[0], after.Items[0])
	}

	c.Put(statusPath(mom, rule), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressDone}, http.StatusOK, nil)
	if p := progressOf(t, getPlan(c, mom), rule); p != "done" {
		t.Errorf("plan shows %q for %s after done, want done", p, rule)
	}

	// The journey timeline shows the head of the same plan, with progress.
	j := getJourney(c, mom)
	found := false
	for _, it := range j.Upcoming {
		if it.RuleId == rule {
			found = true
			if it.Progress == nil || *it.Progress != httpapi.PlanItemProgressDone {
				t.Errorf("journey upcoming %s has progress %v, want done", rule, it.Progress)
			}
		}
	}
	if !found {
		t.Errorf("%s is not in the journey's upcoming items", rule)
	}
	if n := c.AuditCount(fam.Id, "update", "plan_item_progress"); n != 2 {
		t.Errorf("update audit rows = %d, want 2", n)
	}
}

// Progress belongs to one parent: the other parent's plan never shows it.
func TestPlanItemProgressIsPerParent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	// Mark everything on the mother's plan, so any item the two plans share is covered.
	for _, it := range getPlan(c, mom).Items {
		c.Put(statusPath(mom, it.RuleId), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressDone}, http.StatusOK, nil)
	}
	partnerPlan := getPlan(c, partner)
	if len(partnerPlan.Items) == 0 {
		t.Fatal("the pregnancy demo partner has an empty plan")
	}
	for _, it := range partnerPlan.Items {
		if it.Progress != nil {
			t.Errorf("partner's %s shows the mother's progress %s", it.RuleId, *it.Progress)
		}
	}

	// And the partner's own progress does not show on the mother's plan.
	rule := partnerPlan.Items[0].RuleId
	c.Put(statusPath(partner, rule), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressBooked}, http.StatusOK, nil)
	if p := progressOf(t, getPlan(c, partner), rule); p != "booked" {
		t.Errorf("partner plan shows %q for %s, want booked", p, rule)
	}
	for _, it := range getPlan(c, mom).Items {
		if it.Progress != nil && *it.Progress != httpapi.PlanItemProgressDone {
			t.Errorf("mother's %s shows %s, want only her own done", it.RuleId, *it.Progress)
		}
	}
}

func TestPlanItemProgressErrors(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	rule := getPlan(c, mom).Items[0].RuleId

	// 400: the contract only knows booked and done, and status is required.
	c.Put(statusPath(mom, rule), map[string]string{"status": "snoozed"}, http.StatusBadRequest, nil)
	c.Put(statusPath(mom, rule), map[string]string{}, http.StatusBadRequest, nil)

	// 404: unknown parent, and a rule that is not on this parent's plan.
	c.Put("/api/members/"+uuid.NewString()+"/plan/"+rule+"/status", httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressDone}, http.StatusNotFound, nil)
	var e httpapi.Error
	c.Put(statusPath(mom, "no-such-rule"), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressDone}, http.StatusNotFound, &e)
	if e.Message == "" {
		t.Error("404 for an unknown rule has no message")
	}

	// 401: no session.
	anon := testutil.New(t)
	anon.Put(statusPath(mom, rule), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressDone}, http.StatusUnauthorized, nil)

	// Nothing above was stored.
	for _, it := range getPlan(c, mom).Items {
		if it.Progress != nil {
			t.Errorf("%s has progress %s after only failed requests", it.RuleId, *it.Progress)
		}
	}
}

func TestPlanItemProgressOtherFamilyIsUnreachable(t *testing.T) {
	owner := testutil.New(t)
	fam := owner.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	rule := getPlan(owner, mom).Items[0].RuleId

	stranger := testutil.New(t)
	stranger.StartDemo("pregnancy")
	stranger.Put(statusPath(mom, rule), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressDone}, http.StatusNotFound, nil)

	if p := progressOf(t, getPlan(owner, mom), rule); p != "" {
		t.Errorf("another family's request stored %q on %s", p, rule)
	}
}
