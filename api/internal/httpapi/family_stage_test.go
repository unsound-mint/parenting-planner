package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace the baby-arrival case with the reference tests (see
// wellbeing_test.go) when its handler lands (#235).
func TestBabyArrivalIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	stubCall{"POST", m + "/baby-arrival", map[string]any{"name": "Ava", "birthDate": "2026-11-14"}}.expectNotImplemented(t, c)
}

func TestMovingTheDueDateMovesTheWeek(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/family"

	var out httpapi.Family
	c.Patch(path, map[string]any{"dueDate": "2027-01-02"}, http.StatusOK, &out)
	if out.GestationalWeek == nil || *out.GestationalWeek != 33 || out.Stage != httpapi.StagePregnancy {
		t.Errorf("after moving the due date: week=%v stage=%s", out.GestationalWeek, out.Stage)
	}
	var again httpapi.Family
	c.Get("/api/family", http.StatusOK, &again)
	if again.GestationalWeek == nil || *again.GestationalWeek != 33 {
		t.Error("the stored due date did not change")
	}
}

func TestStageChangeRules(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("planning")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/family"

	// Pregnancy needs a due date, sent or stored.
	var e httpapi.Error
	c.Patch(path, map[string]any{"stage": "pregnancy"}, http.StatusBadRequest, &e)
	var out httpapi.Family
	c.Patch(path, map[string]any{"stage": "pregnancy", "dueDate": "2027-03-01"}, http.StatusOK, &out)
	if out.Stage != httpapi.StagePregnancy || out.DueDate == nil || out.GestationalWeek == nil {
		t.Errorf("pregnancy family: %+v", out)
	}

	// A date that is not a plausible due date.
	c.Patch(path, map[string]any{"dueDate": "2025-01-01"}, http.StatusBadRequest, nil)
	c.Patch(path, map[string]any{"dueDate": "2030-01-01"}, http.StatusBadRequest, nil)

	// After birth needs a child, which only "Baby is home" adds.
	c.Patch(path, map[string]any{"stage": "postpartum"}, http.StatusConflict, &e)
	if e.Code != "no_child" {
		t.Errorf("code = %q", e.Code)
	}

	// Leaving pregnancy for planning clears the due date; sending one is wrong.
	c.Patch(path, map[string]any{"stage": "planning", "dueDate": "2027-03-01"}, http.StatusBadRequest, nil)
	out = httpapi.Family{} // decoding into a used struct keeps old fields
	c.Patch(path, map[string]any{"stage": "planning"}, http.StatusOK, &out)
	if out.DueDate != nil || out.GestationalWeek != nil || out.Stage != httpapi.StagePlanning {
		t.Errorf("planning family keeps pregnancy data: %+v", out)
	}
	c.Patch(path, map[string]any{}, http.StatusBadRequest, nil)
}

func TestStageChangeSwitchesTheContent(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("planning"), httpapi.ParentRoleMother)
	base := "/api/members/" + mom.Id.String()
	var l httpapi.GuideList
	c.Get(base+"/guides", http.StatusOK, &l)
	if _, ok := guideIDs(l)["planning-folic-acid"]; !ok {
		t.Fatal("planning family misses planning content")
	}
	c.Patch(base+"/family", map[string]any{"stage": "pregnancy", "dueDate": "2027-01-02"}, http.StatusOK, nil)
	c.Get(base+"/guides", http.StatusOK, &l)
	got := guideIDs(l)
	if _, ok := got["planning-folic-acid"]; ok {
		t.Error("planning content after the move to pregnancy")
	}
	if _, ok := got["preg-rsv"]; !ok {
		t.Error("week 33 content missing after the move to pregnancy")
	}
}

func TestStageChangeIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Patch("/api/members/"+mom.Id.String()+"/family", map[string]any{"dueDate": "2027-01-02"}, http.StatusOK, nil)
	if n := c.AuditCount(fam.Id, "update", "family"); n != 1 {
		t.Errorf("update audit rows = %d, want 1", n)
	}
	// A refused change is not audited.
	c.Patch("/api/members/"+mom.Id.String()+"/family", map[string]any{"stage": "postpartum"}, http.StatusConflict, nil)
	if n := c.AuditCount(fam.Id, "update", "family"); n != 1 {
		t.Errorf("update audit rows after a refusal = %d, want 1", n)
	}
}

func TestPartnerMayChangeTheFamilyAndStrangersMayNot(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	c.Patch("/api/members/"+partner.Id.String()+"/family", map[string]any{"dueDate": "2027-01-02"}, http.StatusOK, nil)

	c2 := testutil.New(t)
	c2.StartDemo("pregnancy")
	c2.Patch("/api/members/"+partner.Id.String()+"/family", map[string]any{"dueDate": "2027-01-02"}, http.StatusNotFound, nil)
}
