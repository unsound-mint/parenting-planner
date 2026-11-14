package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func lossPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/pregnancy-loss" }

func TestPregnancyLossTurnsSupportOnAndStopsPregnancyThings(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Post(lossPath(uuid.New()), map[string]any{}, http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	planIDs := func() map[string]bool {
		var pl httpapi.Plan
		c.Get("/api/members/"+mom.Id.String()+"/plan", http.StatusOK, &pl)
		ids := map[string]bool{}
		for _, it := range pl.Items {
			ids[it.RuleId] = true
		}
		return ids
	}
	if !planIDs()["glucose-screen"] || fam.GestationalWeek == nil {
		t.Fatal("setup: a pregnant family has a week and the glucose screen")
	}

	var got httpapi.Family
	c.Post(lossPath(mom.Id), map[string]any{"occurredOn": "2026-11-10"}, http.StatusCreated, &got)
	if got.Stage != httpapi.StagePlanning || got.DueDate != nil || got.GestationalWeek != nil {
		t.Fatalf("stage planning, no due date, no week: %+v", got)
	}
	if got.PregnancyLoss == nil || got.PregnancyLoss.OccurredOn == nil || got.PregnancyLoss.OccurredOn.Format("2006-01-02") != "2026-11-10" {
		t.Errorf("pregnancyLoss = %+v", got.PregnancyLoss)
	}
	var again httpapi.Family
	c.Get("/api/family", http.StatusOK, &again)
	if again.PregnancyLoss == nil {
		t.Error("GET /family must show the loss while support is on")
	}
	if planIDs()["glucose-screen"] {
		t.Error("pregnancy plan items must stop")
	}
	// A second tap is refused: the family is no longer pregnant.
	c.Post(lossPath(mom.Id), map[string]any{}, http.StatusConflict, nil)
	if n := c.AuditCount(fam.Id, "create", "pregnancy_loss"); n != 1 {
		t.Errorf("create audit rows = %d", n)
	}
}

func TestPregnancyLossCanBeUndoneOrEndedByPlanning(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	jake := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	c.Delete(lossPath(jake.Id), http.StatusConflict, nil) // nothing to undo yet

	c.Post(lossPath(jake.Id), map[string]any{}, http.StatusCreated, nil) // every field is optional
	var restored httpapi.Family
	c.Delete(lossPath(jake.Id), http.StatusOK, &restored)
	if restored.Stage != httpapi.StagePregnancy || restored.DueDate == nil || !restored.DueDate.Time.Equal(fam.DueDate.Time) || restored.GestationalWeek == nil || restored.PregnancyLoss != nil {
		t.Errorf("undo restores the stage and due date: %+v", restored)
	}
	c.Delete(lossPath(jake.Id), http.StatusConflict, nil)

	// A family ready to try again leaves support mode through the normal stage change, restoring nothing.
	c.Post(lossPath(jake.Id), map[string]any{}, http.StatusCreated, nil)
	var trying httpapi.Family
	c.Patch("/api/members/"+jake.Id.String()+"/family", map[string]any{"stage": "trying"}, http.StatusOK, &trying)
	if trying.Stage != httpapi.StageTrying || trying.PregnancyLoss != nil || trying.DueDate != nil {
		t.Errorf("trying again ends support: %+v", trying)
	}
	c.Delete(lossPath(jake.Id), http.StatusConflict, nil) // and there is nothing left to undo
}

func TestPregnancyLossValidationAndAccess(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Post(lossPath(mom.Id), map[string]any{"occurredOn": "2026-11-20"}, http.StatusBadRequest, nil) // a future date
	c.Post(lossPath(mom.Id), map[string]any{"occurredOn": "yesterday"}, http.StatusBadRequest, nil)
	c.Get("/api/family", http.StatusOK, nil)
	for _, p := range []string{"planning", "newborn", "preschool"} {
		other := c.StartDemo(p) // not pregnant: 409
		c.Post(lossPath(testutil.Parent(t, other, httpapi.ParentRoleMother).Id), map[string]any{}, http.StatusConflict, nil)
	}
	c.Post(lossPath(uuid.New()), map[string]any{}, http.StatusNotFound, nil)
	// Another family's mother is not reachable.
	c.StartDemo("pregnancy")
	c.Post(lossPath(mom.Id), map[string]any{}, http.StatusNotFound, nil)
}
