package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func famPath(m httpapi.Parent) string     { return "/api/members/" + m.Id.String() + "/family" }
func arrivalPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/baby-arrival" }

func TestMovingTheDueDateMovesTheWeek(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy") // week 25
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var got httpapi.Family
	c.Patch(famPath(mom), map[string]any{"dueDate": fam.DueDate.Time.AddDate(0, 0, 14).Format("2006-01-02")}, http.StatusOK, &got)
	if got.GestationalWeek == nil || *got.GestationalWeek != 23 {
		t.Errorf("week = %v, want 23 after moving the due date two weeks later", got.GestationalWeek)
	}
	var again httpapi.Family
	c.Get("/api/family", http.StatusOK, &again)
	if again.DueDate == nil || !again.DueDate.Time.Equal(got.DueDate.Time) {
		t.Error("the new due date must be stored")
	}
}

func TestFamilyUpdateRules(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("planning")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Patch(famPath(mom), map[string]any{}, http.StatusBadRequest, nil)                     // nothing to change
	c.Patch(famPath(mom), map[string]any{"stage": "pregnancy"}, http.StatusBadRequest, nil) // no due date
	c.Patch(famPath(mom), map[string]any{"stage": "postpartum"}, http.StatusConflict, nil)  // no child: use Baby is home
	c.Patch(famPath(mom), map[string]any{"stage": "pregnancy", "dueDate": "2031-01-01"}, http.StatusBadRequest, nil)
	c.Patch(famPath(mom), map[string]any{"stage": "teen"}, http.StatusBadRequest, nil)

	var got httpapi.Family
	due := testutil.Now.AddDate(0, 0, 200).Format("2006-01-02")
	c.Patch(famPath(mom), map[string]any{"stage": "pregnancy", "dueDate": due}, http.StatusOK, &got)
	if got.Stage != httpapi.StagePregnancy || got.GestationalWeek == nil {
		t.Fatalf("family = %+v", got)
	}
	got = httpapi.Family{} // decode into a fresh value: absent JSON fields would keep the old ones
	c.Patch(famPath(mom), map[string]any{"stage": "trying"}, http.StatusOK, &got)
	if got.Stage != httpapi.StageTrying || got.DueDate != nil || got.GestationalWeek != nil {
		t.Errorf("leaving pregnancy must clear the due date: %+v", got)
	}
	for _, cg := range fam.Caregivers {
		c.Patch("/api/members/"+cg.Id.String()+"/family", map[string]any{"stage": "planning"}, http.StatusForbidden, nil)
	}
}

func TestBabyIsHome(t *testing.T) {
	c := testutil.New(t)
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
	if !planIDs()["glucose-screen"] {
		t.Fatal("setup: the pregnancy plan must have the glucose screen")
	}
	// No baby yet: the care log is closed.
	c.Post(careLog(mom.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Hour)}, http.StatusConflict, nil)

	today := testutil.Now.Format("2006-01-02")
	c.Post(arrivalPath(mom), map[string]any{"name": "Ava", "birthDate": testutil.Now.AddDate(0, 0, 1).Format("2006-01-02")}, http.StatusBadRequest, nil)   // future
	c.Post(arrivalPath(mom), map[string]any{"name": "Ava", "birthDate": testutil.Now.AddDate(0, 0, -31).Format("2006-01-02")}, http.StatusBadRequest, nil) // too long ago
	c.Post(arrivalPath(mom), map[string]any{"name": "", "birthDate": today}, http.StatusBadRequest, nil)
	for _, cg := range fam.Caregivers {
		c.Post("/api/members/"+cg.Id.String()+"/baby-arrival", map[string]any{"name": "Ava", "birthDate": today}, http.StatusForbidden, nil)
	}

	var got httpapi.Family
	c.Post(arrivalPath(mom), map[string]any{"name": "Ava", "birthDate": testutil.Now.AddDate(0, 0, -2).Format("2006-01-02")}, http.StatusCreated, &got)
	if got.Stage != httpapi.StagePostpartum || len(got.Children) != 1 || got.Children[0].Name != "Ava" || got.GestationalWeek != nil {
		t.Fatalf("family = %+v", got)
	}
	if got.Children[0].AgeMonths != 0 {
		t.Errorf("age = %d months", got.Children[0].AgeMonths)
	}
	// A second call is refused, the care log opens, and pregnancy items are gone.
	c.Post(arrivalPath(mom), map[string]any{"name": "Zoe", "birthDate": today}, http.StatusConflict, nil)
	c.Post(careLog(mom.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Hour)}, http.StatusCreated, nil)
	if planIDs()["glucose-screen"] {
		t.Error("pregnancy plan items must stop after Baby is home")
	}
}
