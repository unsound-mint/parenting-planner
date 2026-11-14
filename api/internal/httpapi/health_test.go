package httpapi_test

import (
	"context"
	"net/http"
	"slices"
	"strings"
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
	if s.Kind != "glucose_screen" || s.Name != "Glucose screening" || s.Visibility != httpapi.VisibilityPrivate || s.ChildId != nil {
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

func labByName(labs []httpapi.LabResult, name string) *httpapi.LabResult {
	for i := range labs {
		if labs[i].Name == name {
			return &labs[i]
		}
	}
	return nil
}

// A parent corrects and removes their own lab value; the flag and its reason
// are recomputed from the stored range, and every write is audited.
func TestLabResultEditAndDelete(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m, d := "/api/members/"+mom.Id.String(), "/api/members/"+dad.Id.String()
	updBefore, delBefore := c.AuditCount(fam.Id, "update", "lab_result"), c.AuditCount(fam.Id, "delete", "lab_result")

	var lab httpapi.LabResult
	c.Post(m+"/lab-results", map[string]any{"name": "Zinc", "value": 50, "unit": "ug/dL", "refLow": 30, "refHigh": 100, "takenOn": "2026-11-10", "visibility": "private"}, http.StatusCreated, &lab)
	if lab.Flag != nil {
		t.Fatalf("in range, got flag %+v", lab.Flag)
	}
	var got httpapi.LabResult
	c.Put(m+"/lab-results/"+lab.Id.String(), map[string]any{"name": "Zinc", "value": 24, "unit": "ug/dL", "refLow": 30, "takenOn": "2026-11-11", "visibility": "partner"}, http.StatusOK, &got)
	if got.Value != 24 || got.RefHigh != nil || got.Visibility != httpapi.VisibilityPartner || got.Flag == nil || got.Flag.Direction != httpapi.Low {
		t.Fatalf("updated lab = %+v flag %+v", got, got.Flag)
	}
	if !strings.Contains(got.Flag.Reason, "24 ug/dL is below the range of at least 30 ug/dL") {
		t.Errorf("reason = %q", got.Flag.Reason)
	}
	if l := labByName(person(t, getPassport(t, c, dad.Id), mom.Id).Labs, "Zinc"); l == nil || l.Value != 24 {
		t.Errorf("the partner must now see the shared, edited lab, got %+v", l)
	}

	// Validation, and a screening is not a lab.
	bad := map[string]any{"name": "Zinc", "value": 24, "unit": "ug/dL", "takenOn": "2026-11-11", "visibility": "private"}
	c.Put(m+"/lab-results/"+lab.Id.String(), merge(bad, map[string]any{"takenOn": "2026-12-01"}), http.StatusBadRequest, nil)
	c.Put(m+"/lab-results/"+lab.Id.String(), merge(bad, map[string]any{"refLow": 9, "refHigh": 1}), http.StatusBadRequest, nil)
	c.Put(m+"/lab-results/"+lab.Id.String(), merge(bad, map[string]any{"name": " "}), http.StatusBadRequest, nil)
	var scr httpapi.Screening
	c.Post(m+"/screenings", map[string]any{"kind": "gbs", "takenOn": "2026-11-10", "visibility": "family"}, http.StatusCreated, &scr)
	c.Put(m+"/lab-results/"+scr.Id.String(), bad, http.StatusNotFound, nil)
	c.Delete(m+"/lab-results/"+scr.Id.String(), http.StatusNotFound, nil)

	// The other parent cannot change it, even though it is shared with them.
	c.Put(d+"/lab-results/"+lab.Id.String(), bad, http.StatusNotFound, nil)
	c.Delete(d+"/lab-results/"+lab.Id.String(), http.StatusNotFound, nil)
	c.Put(m+"/lab-results/"+uuid.NewString(), bad, http.StatusNotFound, nil)

	c.Delete(m+"/lab-results/"+lab.Id.String(), http.StatusNoContent, nil)
	if labByName(person(t, getPassport(t, c, mom.Id), mom.Id).Labs, "Zinc") != nil {
		t.Error("the deleted lab is still in the passport")
	}
	c.Delete(m+"/lab-results/"+lab.Id.String(), http.StatusNotFound, nil)

	if got := c.AuditCount(fam.Id, "update", "lab_result") - updBefore; got != 1 {
		t.Errorf("lab_result update audit rows = %d, want 1", got)
	}
	if got := c.AuditCount(fam.Id, "delete", "lab_result") - delBefore; got != 1 {
		t.Errorf("lab_result delete audit rows = %d, want 1", got)
	}

	// Either parent may edit a child's lab.
	nb := testutil.New(t)
	nfam := nb.StartDemo("newborn")
	nm, nd := testutil.Parent(t, nfam, httpapi.ParentRoleMother), testutil.Parent(t, nfam, httpapi.ParentRolePartner)
	child := nfam.Children[0].Id
	var cl httpapi.LabResult
	nb.Post("/api/members/"+nm.Id.String()+"/lab-results", map[string]any{"childId": child, "name": "Lead", "value": 1, "unit": "ug/dL", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusCreated, &cl)
	nb.Put("/api/members/"+nd.Id.String()+"/lab-results/"+cl.Id.String(), map[string]any{"name": "Lead", "value": 2, "unit": "ug/dL", "takenOn": "2026-11-10", "visibility": "family"}, http.StatusOK, &cl)
	if cl.Value != 2 {
		t.Errorf("child lab = %+v", cl)
	}
	nb.Delete("/api/members/"+nd.Id.String()+"/lab-results/"+cl.Id.String(), http.StatusNoContent, nil)
}

func merge(a, b map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range a {
		out[k] = v
	}
	for k, v := range b {
		out[k] = v
	}
	return out
}

func TestScreeningCatalogAndEdit(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m, d := "/api/members/"+mom.Id.String(), "/api/members/"+dad.Id.String()

	opts := person(t, getPassport(t, c, mom.Id), mom.Id).ScreeningOptions
	if len(opts) < 2 || opts[0].Label != "Pregnancy" || opts[len(opts)-1].Options[0].Kind != "other" {
		t.Errorf("mother's screening options = %+v", opts)
	}

	var s httpapi.Screening
	c.Post(m+"/screenings", map[string]any{"kind": "other", "name": "  Thyroid ultrasound ", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusCreated, &s)
	if s.Kind != "other" || s.Name != "Thyroid ultrasound" {
		t.Errorf("created = %+v", s)
	}
	list := person(t, getPassport(t, c, mom.Id), mom.Id).Screenings
	if len(list) == 0 || list[0].Id != s.Id || list[0].Name != "Thyroid ultrasound" {
		t.Errorf("passport screenings = %+v", list)
	}
	for _, x := range person(t, getPassport(t, c, dad.Id), mom.Id).Screenings {
		if x.Id == s.Id {
			t.Error("the partner sees a private screening")
		}
	}

	c.Post(m+"/screenings", map[string]any{"kind": "other", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(m+"/screenings", map[string]any{"kind": "other", "name": "  ", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(m+"/screenings", map[string]any{"kind": "made_up", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusBadRequest, nil)

	var u httpapi.Screening
	c.Put(m+"/screenings/"+s.Id.String(), map[string]any{"kind": "cbc", "name": "ignored", "takenOn": "2026-11-12", "visibility": "family"}, http.StatusOK, &u)
	if u.Kind != "cbc" || u.Name != "Complete blood count" || u.Visibility != httpapi.VisibilityFamily {
		t.Errorf("updated = %+v", u)
	}
	c.Put(m+"/screenings/"+s.Id.String(), map[string]any{"kind": "other", "takenOn": "2026-11-12", "visibility": "family"}, http.StatusBadRequest, nil)
	c.Put(m+"/screenings/"+s.Id.String(), map[string]any{"kind": "nope", "takenOn": "2026-11-12", "visibility": "family"}, http.StatusBadRequest, nil)
	c.Put(m+"/screenings/"+s.Id.String(), map[string]any{"kind": "cbc", "takenOn": "2026-12-12", "visibility": "family"}, http.StatusBadRequest, nil)
	c.Put(d+"/screenings/"+s.Id.String(), map[string]any{"kind": "cbc", "takenOn": "2026-11-12", "visibility": "family"}, http.StatusNotFound, nil)
	c.Delete(d+"/screenings/"+s.Id.String(), http.StatusNotFound, nil)

	// A lab value is not a screening.
	var lab httpapi.LabResult
	c.Post(m+"/lab-results", map[string]any{"name": "Ferritin", "value": 50, "unit": "ng/mL", "takenOn": "2026-11-10", "visibility": "private"}, http.StatusCreated, &lab)
	c.Put(m+"/screenings/"+lab.Id.String(), map[string]any{"kind": "cbc", "takenOn": "2026-11-12", "visibility": "family"}, http.StatusNotFound, nil)
	c.Delete(m+"/screenings/"+lab.Id.String(), http.StatusNotFound, nil)

	c.Delete(m+"/screenings/"+s.Id.String(), http.StatusNoContent, nil)
	for _, x := range person(t, getPassport(t, c, mom.Id), mom.Id).Screenings {
		if x.Id == s.Id {
			t.Error("the deleted screening is still listed")
		}
	}
}

func TestAllergyCreateEditDelete(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m, d := "/api/members/"+mom.Id.String(), "/api/members/"+dad.Id.String()
	child := fam.Children[0].Id
	before := map[string]int{}
	for _, a := range []string{"create", "update", "delete"} {
		before[a] = c.AuditCount(fam.Id, a, "allergy")
	}

	var a httpapi.Allergy
	c.Post(m+"/allergies", map[string]any{"substance": " Penicillin ", "certainty": "suspected", "reaction": "Rash", "visibility": "private"}, http.StatusCreated, &a)
	if a.Substance != "Penicillin" || a.NotedOn == nil || a.Visibility != httpapi.VisibilityPrivate {
		t.Errorf("allergy = %+v", a)
	}
	var kid httpapi.Allergy
	c.Post(m+"/allergies", map[string]any{"childId": child, "substance": "Peanut", "certainty": "confirmed", "visibility": "family"}, http.StatusCreated, &kid)
	c.Post(m+"/allergies", map[string]any{"childId": c2Child(t), "substance": "Peanut", "certainty": "confirmed", "visibility": "family"}, http.StatusNotFound, nil)
	c.Post(m+"/allergies", map[string]any{"substance": "  ", "certainty": "confirmed", "visibility": "family"}, http.StatusBadRequest, nil)

	has := func(p httpapi.Passport, who uuid.UUID, id uuid.UUID) bool {
		for _, x := range person(t, p, who).Allergies {
			if x.Id == id {
				return true
			}
		}
		return false
	}
	if !has(getPassport(t, c, mom.Id), mom.Id, a.Id) || has(getPassport(t, c, dad.Id), mom.Id, a.Id) {
		t.Error("the private allergy must be listed for its author only")
	}

	var u httpapi.Allergy
	c.Put(m+"/allergies/"+a.Id.String(), map[string]any{"substance": "Penicillin", "certainty": "confirmed", "visibility": "partner"}, http.StatusOK, &u)
	if u.Certainty != httpapi.Confirmed || u.Reaction != nil || u.NotedOn == nil || !u.NotedOn.Equal(a.NotedOn.Time) {
		t.Errorf("updated = %+v", u)
	}
	if !has(getPassport(t, c, dad.Id), mom.Id, a.Id) {
		t.Error("the partner must see the allergy once shared")
	}
	bad := map[string]any{"substance": "Penicillin", "certainty": "confirmed", "visibility": "family"}
	c.Put(d+"/allergies/"+a.Id.String(), bad, http.StatusNotFound, nil)
	c.Delete(d+"/allergies/"+a.Id.String(), http.StatusNotFound, nil)
	c.Put(m+"/allergies/"+a.Id.String(), merge(bad, map[string]any{"substance": " "}), http.StatusBadRequest, nil)

	// A child's allergy: either parent may change it.
	c.Put(d+"/allergies/"+kid.Id.String(), map[string]any{"substance": "Peanut", "certainty": "suspected", "visibility": "family"}, http.StatusOK, nil)
	c.Delete(d+"/allergies/"+kid.Id.String(), http.StatusNoContent, nil)
	c.Delete(m+"/allergies/"+a.Id.String(), http.StatusNoContent, nil)
	c.Delete(m+"/allergies/"+a.Id.String(), http.StatusNotFound, nil)
	if has(getPassport(t, c, mom.Id), mom.Id, a.Id) {
		t.Error("the deleted allergy is still listed")
	}

	for action, want := range map[string]int{"create": 2, "update": 2, "delete": 2} {
		if got := c.AuditCount(fam.Id, action, "allergy") - before[action]; got != want {
			t.Errorf("allergy %s audit rows = %d, want %d", action, got, want)
		}
	}
}

func TestImmunizationEditAndDelete(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m, d := "/api/members/"+mom.Id.String(), "/api/members/"+dad.Id.String()

	var dose httpapi.VaccineDose
	c.Post(m+"/immunizations", map[string]any{"vaccine": "tdap", "givenOn": "2026-11-12"}, http.StatusCreated, &dose)
	var u httpapi.VaccineDose
	c.Put(m+"/immunizations/"+dose.Id.String(), map[string]any{"vaccine": "flu", "dose": "This season", "givenOn": "2026-11-10"}, http.StatusOK, &u)
	if u.Name != "Flu" || u.Dose != "This season" || u.GivenOn == nil || u.Status != httpapi.VaccineStatusDone {
		t.Errorf("updated = %+v", u)
	}
	c.Put(m+"/immunizations/"+dose.Id.String(), map[string]any{"vaccine": "flu", "givenOn": "2026-12-10"}, http.StatusBadRequest, nil)
	c.Put(d+"/immunizations/"+dose.Id.String(), map[string]any{"vaccine": "flu", "givenOn": "2026-11-10"}, http.StatusNotFound, nil)
	c.Delete(d+"/immunizations/"+dose.Id.String(), http.StatusNotFound, nil)

	// A scheduled dose has no immunization row: 404.
	for _, v := range person(t, getPassport(t, c, mom.Id), mom.Id).Vaccines {
		if v.Status != httpapi.VaccineStatusDone {
			c.Put(m+"/immunizations/"+v.Id.String(), map[string]any{"vaccine": "tdap", "givenOn": "2026-11-10"}, http.StatusNotFound, nil)
			c.Delete(m+"/immunizations/"+v.Id.String(), http.StatusNotFound, nil)
			break
		}
	}

	c.Delete(m+"/immunizations/"+dose.Id.String(), http.StatusNoContent, nil)
	for _, v := range person(t, getPassport(t, c, mom.Id), mom.Id).Vaccines {
		if v.Id == dose.Id {
			t.Error("the deleted dose is still listed")
		}
	}
	c.Delete(m+"/immunizations/"+dose.Id.String(), http.StatusNotFound, nil)
}

func TestCareTeamCreateEditDelete(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m, d := "/api/members/"+mom.Id.String(), "/api/members/"+dad.Id.String()
	child := fam.Children[0].Id

	var dentist httpapi.CareTeamMember
	c.Post(m+"/care-team", map[string]any{"name": " Dr. Rao ", "role": "dentist", "clinic": " ", "phone": "555 0100"}, http.StatusCreated, &dentist)
	if dentist.Name != "Dr. Rao" || dentist.Role != httpapi.CareRoleDentist || dentist.Clinic != "" || dentist.Phone == nil {
		t.Errorf("dentist = %+v", dentist)
	}
	var obs httpapi.CareTeamMember
	c.Post(m+"/care-team", map[string]any{"name": "Dr. Ito", "role": "obstetrician", "clinic": "Elm Clinic"}, http.StatusCreated, &obs)
	if obs.Role != httpapi.CareRoleObstetrician || obs.Clinic != "Elm Clinic" {
		t.Errorf("obstetrician = %+v", obs)
	}
	var kids httpapi.CareTeamMember
	c.Post(m+"/care-team", map[string]any{"childId": child, "name": "Dr. Kim", "role": "pediatrician"}, http.StatusCreated, &kids)
	c.Post(m+"/care-team", map[string]any{"childId": c2Child(t), "name": "Dr. Kim", "role": "pediatrician"}, http.StatusNotFound, nil)
	c.Post(m+"/care-team", map[string]any{"name": " ", "role": "dentist"}, http.StatusBadRequest, nil)

	onTeam := func(p httpapi.Passport, who, id uuid.UUID) *httpapi.CareTeamMember {
		for _, x := range person(t, p, who).CareTeam {
			if x.Id == id {
				return &x
			}
		}
		return nil
	}
	if onTeam(getPassport(t, c, mom.Id), mom.Id, dentist.Id) == nil || onTeam(getPassport(t, c, mom.Id), child, kids.Id) == nil {
		t.Error("the new clinicians must be on the passport")
	}

	var u httpapi.CareTeamMember
	c.Put(m+"/care-team/"+dentist.Id.String(), map[string]any{"name": "Dr. Rao", "role": "primary_care", "clinic": "Oak St", "phone": "555 0111"}, http.StatusOK, &u)
	if u.Role != httpapi.CareRolePrimaryCare || u.Clinic != "Oak St" || *u.Phone != "555 0111" {
		t.Errorf("updated = %+v", u)
	}
	c.Put(m+"/care-team/"+dentist.Id.String(), map[string]any{"name": " ", "role": "dentist"}, http.StatusBadRequest, nil)
	// The other parent's own clinician is not theirs to change; the child's is.
	c.Put(d+"/care-team/"+dentist.Id.String(), map[string]any{"name": "X", "role": "dentist"}, http.StatusNotFound, nil)
	c.Delete(d+"/care-team/"+dentist.Id.String(), http.StatusNotFound, nil)
	c.Put(d+"/care-team/"+kids.Id.String(), map[string]any{"name": "Dr. Kim Jr", "role": "pediatrician"}, http.StatusOK, nil)

	// A psychologist of the other parent is hidden and untouchable.
	var psy uuid.UUID
	err := c.Pool.QueryRow(context.Background(),
		`INSERT INTO care_team (family_id, role, name, subject_member_id) VALUES ($1, 'psychologist', 'Dr. Mind', $2) RETURNING id`,
		fam.Id, dad.Id).Scan(&psy)
	if err != nil {
		t.Fatal(err)
	}
	c.Put(m+"/care-team/"+psy.String(), map[string]any{"name": "X", "role": "psychologist"}, http.StatusNotFound, nil)
	c.Delete(m+"/care-team/"+psy.String(), http.StatusNotFound, nil)
	c.Put(d+"/care-team/"+psy.String(), map[string]any{"name": "Dr. Mind", "role": "psychologist", "clinic": "Hill"}, http.StatusOK, nil)

	// A row shared by role (no subject) can be changed by either parent, but
	// never turned into a psychologist, which would hide it from everyone.
	var shared uuid.UUID
	if err := c.Pool.QueryRow(context.Background(),
		`INSERT INTO care_team (family_id, role, name) VALUES ($1, 'pediatrician', 'Dr. Shared') RETURNING id`, fam.Id).Scan(&shared); err != nil {
		t.Fatal(err)
	}
	c.Put(m+"/care-team/"+shared.String(), map[string]any{"name": "Dr. Shared", "role": "psychologist"}, http.StatusNotFound, nil)
	c.Put(m+"/care-team/"+shared.String(), map[string]any{"name": "Dr. Shared 2", "role": "pediatrician"}, http.StatusOK, nil)
	c.Delete(d+"/care-team/"+shared.String(), http.StatusNoContent, nil)

	c.Delete(m+"/care-team/"+dentist.Id.String(), http.StatusNoContent, nil)
	if onTeam(getPassport(t, c, mom.Id), mom.Id, dentist.Id) != nil {
		t.Error("the deleted clinician is still listed")
	}
	c.Delete(m+"/care-team/"+dentist.Id.String(), http.StatusNotFound, nil)
}
