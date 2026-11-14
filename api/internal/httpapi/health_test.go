package httpapi_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func planIDs(c *testutil.Client, p httpapi.Parent) []string {
	var pl httpapi.Plan
	c.Get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
	return ruleIDs(pl.Items)
}

// inPlanAndJourney reports whether the rule is in the parent's plan and in the
// journey's upcoming list.
func inPlanAndJourney(c *testutil.Client, p httpapi.Parent, rule string) (plan, journey bool) {
	return slices.Contains(planIDs(c, p), rule), slices.Contains(ruleIDs(getJourney(c, p).Upcoming), rule)
}

func TestHealthLoggingValidation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()

	// Contract checks: unknown vaccine or kind, missing visibility or value.
	c.Post(m+"/immunizations", map[string]any{"vaccine": "smallpox", "givenOn": "2026-11-10"}, http.StatusBadRequest, nil)
	c.Post(m+"/immunizations", map[string]any{"vaccine": "tdap"}, http.StatusBadRequest, nil)
	c.Post(m+"/screenings", map[string]any{"kind": "glucose_screen", "takenOn": "2026-11-10"}, http.StatusBadRequest, nil)
	c.Post(m+"/screenings", map[string]any{"kind": "blood_type", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(m+"/lab-results", map[string]any{"name": "Ferritin", "unit": "ng/mL", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(m+"/lab-results", map[string]any{"name": "Ferritin", "value": 20, "unit": "ng/mL", "takenOn": "2026-11-10", "visibility": "everyone"}, http.StatusBadRequest, nil)

	// Server checks: future dates, an inverted range, blank names.
	c.Post(m+"/immunizations", map[string]any{"vaccine": "tdap", "givenOn": "2026-11-15"}, http.StatusBadRequest, nil)
	c.Post(m+"/screenings", map[string]any{"kind": "gbs", "takenOn": "2026-12-01", "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(m+"/lab-results", map[string]any{"name": "Ferritin", "value": 20, "unit": "ng/mL", "refLow": 150, "refHigh": 15, "takenOn": "2026-11-10", "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(m+"/lab-results", map[string]any{"name": "  ", "value": 20, "unit": "ng/mL", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusBadRequest, nil)

	// A child of another family, or no such child: 404, nothing written.
	other := c2Child(t)
	c.Post(m+"/immunizations", map[string]any{"childId": other, "vaccine": "dtap", "givenOn": "2026-11-10"}, http.StatusNotFound, nil)
	c.Post(m+"/screenings", map[string]any{"childId": uuid.New(), "kind": "vision_screen", "takenOn": "2026-11-10", "visibility": "family"}, http.StatusNotFound, nil)
	c.Post(m+"/lab-results", map[string]any{"childId": other, "name": "Lead", "value": 1, "unit": "ug/dL", "takenOn": "2026-11-10", "visibility": "family"}, http.StatusNotFound, nil)

	// No session, or a parent of another family.
	anon := testutil.New(t)
	anon.Post(m+"/immunizations", map[string]any{"vaccine": "tdap", "givenOn": "2026-11-10"}, http.StatusUnauthorized, nil)
	c.Post("/api/members/"+uuid.New().String()+"/lab-results", map[string]any{"name": "Ferritin", "value": 20, "unit": "ng/mL", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusNotFound, nil)
}

// c2Child starts a newborn family in a separate client and returns its child id.
func c2Child(t *testing.T) uuid.UUID {
	t.Helper()
	return testutil.New(t).StartDemo("newborn").Children[0].Id
}

// Logging Tdap and the glucose screening removes both items from the mother's
// plan and journey; the Tdap dose takes the scheduled label so the passport
// shows it as given instead of due.
func TestLoggingPregnancyRecordsUpdatesThePlan(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m := "/api/members/" + mom.Id.String()

	for _, rule := range []string{"tdap-pregnancy", "glucose-screen"} {
		if p, j := inPlanAndJourney(c, mom, rule); !p || !j {
			t.Fatalf("before logging, %s must be in the plan (%v) and journey (%v)", rule, p, j)
		}
	}

	var dose httpapi.VaccineDose
	c.Post(m+"/immunizations", map[string]any{"vaccine": "tdap", "givenOn": "2026-11-12"}, http.StatusCreated, &dose)
	if dose.Name != "Tdap" || dose.Status != httpapi.VaccineStatusDone || dose.Dose != "This pregnancy" || dose.GivenOn == nil {
		t.Errorf("dose = %+v", dose)
	}
	var s httpapi.Screening
	c.Post(m+"/screenings", map[string]any{"kind": "glucose_screen", "takenOn": "2026-11-13", "visibility": "private"}, http.StatusCreated, &s)
	if s.Kind != httpapi.GlucoseScreen || s.Visibility != httpapi.VisibilityPrivate || s.ChildId != nil {
		t.Errorf("screening = %+v", s)
	}

	for _, rule := range []string{"tdap-pregnancy", "glucose-screen"} {
		if p, j := inPlanAndJourney(c, mom, rule); p || j {
			t.Errorf("after logging, %s is still in the plan (%v) or journey (%v)", rule, p, j)
		}
	}
	// The partner's own Tdap item is about his record and stays.
	if !slices.Contains(planIDs(c, dad), "tdap-partner") {
		t.Errorf("Emily's Tdap must not clear Jake's item, plan %v", planIDs(c, dad))
	}

	tdap := map[httpapi.VaccineStatus]int{}
	for _, v := range person(t, getPassport(t, c, mom.Id), mom.Id).Vaccines {
		if v.Name == "Tdap" {
			tdap[v.Status]++
		}
	}
	if tdap[httpapi.VaccineStatusDone] != 1 || len(tdap) != 1 {
		t.Errorf("passport Tdap = %v, want one done dose and nothing due", tdap)
	}
}

// A first DTaP dose for the baby clears the 2-month vaccines for both parents.
func TestLoggingAChildDoseUpdatesBothPlans(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	child := fam.Children[0].Id

	for _, p := range fam.Parents {
		if pl, j := inPlanAndJourney(c, p, "infant-2-month-vaccines"); !pl || !j {
			t.Fatalf("before logging, %s: plan %v journey %v", p.Role, pl, j)
		}
	}
	var dose httpapi.VaccineDose
	c.Post("/api/members/"+dad.Id.String()+"/immunizations", map[string]any{"childId": child, "vaccine": "dtap", "dose": "Dose 1 of 5", "givenOn": "2026-11-14"}, http.StatusCreated, &dose)
	if dose.Dose != "Dose 1 of 5" || dose.Name != "DTaP" {
		t.Errorf("dose = %+v", dose)
	}
	for _, p := range []httpapi.Parent{mom, dad} {
		if pl, j := inPlanAndJourney(c, p, "infant-2-month-vaccines"); pl || j {
			t.Errorf("after logging, %s: plan %v journey %v", p.Role, pl, j)
		}
	}
	found := false
	for _, v := range person(t, getPassport(t, c, mom.Id), child).Vaccines {
		found = found || (v.Name == "DTaP" && v.Status == httpapi.VaccineStatusDone)
	}
	if !found {
		t.Error("the child's passport must list the DTaP dose as done")
	}
}

// A vision screening for the child clears the item for both parents, even
// when the parent who logged it kept it private: records about the child are
// open to both parents (access.CanParentReadHealthRecord).
func TestLoggingAChildScreeningUpdatesBothPlans(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	child := fam.Children[0].Id

	for _, p := range fam.Parents {
		if pl, j := inPlanAndJourney(c, p, "vision-screen"); !pl || !j {
			t.Fatalf("before logging, %s: plan %v journey %v", p.Role, pl, j)
		}
	}
	var s httpapi.Screening
	c.Post("/api/members/"+mom.Id.String()+"/screenings", map[string]any{"childId": child, "kind": "vision_screen", "takenOn": "2026-11-14", "visibility": "private"}, http.StatusCreated, &s)
	if s.ChildId == nil || *s.ChildId != child {
		t.Errorf("screening = %+v", s)
	}
	for _, p := range []httpapi.Parent{mom, dad} {
		if pl, j := inPlanAndJourney(c, p, "vision-screen"); pl || j {
			t.Errorf("after logging, %s: plan %v journey %v", p.Role, pl, j)
		}
	}
}

// Lab values follow visibility: the partner sees a shared value with its flag
// and never a private one; every write is audited.
func TestLabResultPrivacyAndAudit(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m := "/api/members/" + mom.Id.String()
	labsBefore := c.AuditCount(fam.Id, "create", "lab_result")
	immBefore := c.AuditCount(fam.Id, "create", "immunization")

	var shared, private httpapi.LabResult
	c.Post(m+"/lab-results", map[string]any{"name": "Platelets", "value": 120, "unit": "10^3/uL", "refLow": 150, "refHigh": 400, "takenOn": "2026-11-13", "visibility": "partner"}, http.StatusCreated, &shared)
	c.Post(m+"/lab-results", map[string]any{"name": "Vitamin B12", "value": 950, "unit": "pg/mL", "refLow": 200, "refHigh": 900, "takenOn": "2026-11-13", "visibility": "private"}, http.StatusCreated, &private)
	if shared.Flag == nil || shared.Flag.Direction != httpapi.Low || private.Flag == nil || private.Flag.Direction != httpapi.High {
		t.Errorf("flags on create: shared %+v, private %+v", shared.Flag, private.Flag)
	}
	if shared.Name != "Platelets" || shared.Unit != "10^3/uL" || *shared.RefLow != 150 {
		t.Errorf("shared = %+v", shared)
	}
	c.Post(m+"/immunizations", map[string]any{"vaccine": "flu", "dose": "This season", "givenOn": "2026-11-01"}, http.StatusCreated, nil)
	c.Post(m+"/screenings", map[string]any{"kind": "gbs", "takenOn": "2026-11-13", "visibility": "family"}, http.StatusCreated, nil)

	own := labNames(person(t, getPassport(t, c, mom.Id), mom.Id).Labs)
	seen := person(t, getPassport(t, c, dad.Id), mom.Id).Labs
	if !own["Platelets"] || !own["Vitamin B12"] {
		t.Errorf("Emily must see both new labs, got %v", own)
	}
	if names := labNames(seen); !names["Platelets"] || names["Vitamin B12"] {
		t.Errorf("Jake must see the shared lab only, got %v", names)
	}
	for _, l := range seen {
		if l.Name == "Platelets" && (l.Flag == nil || l.Flag.Direction != httpapi.Low) {
			t.Errorf("Jake sees the shared lab without its flag: %+v", l)
		}
	}

	if got := c.AuditCount(fam.Id, "create", "lab_result") - labsBefore; got != 3 {
		t.Errorf("lab_result create audit rows = %d, want 3 (two labs, one screening)", got)
	}
	if got := c.AuditCount(fam.Id, "create", "immunization") - immBefore; got != 1 {
		t.Errorf("immunization create audit rows = %d, want 1", got)
	}
}
