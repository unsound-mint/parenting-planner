package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func hubPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/family-paperwork" }

func hubItem(h httpapi.FamilyPaperwork, key string) httpapi.PaperworkItem {
	for _, it := range h.Items {
		if it.Key == key {
			return it
		}
	}
	return httpapi.PaperworkItem{}
}

func TestFamilyPaperworkByStage(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get(hubPath(uuid.New()), http.StatusUnauthorized, nil)

	// Newborn: the certificate, number and employer plan are done; the
	// Marketplace window is the next step, counted from the birth date.
	fam := c.StartDemo("newborn")
	mom, marcus := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var h httpapi.FamilyPaperwork
	c.Get(hubPath(mom.Id), http.StatusOK, &h)
	if h.Phase != "newborn" || h.AnchorKind == nil || *h.AnchorKind != "birth_date" {
		t.Fatalf("phase %s anchor %v", h.Phase, h.AnchorKind)
	}
	for _, k := range []string{"birth-certificate", "ssn", "insurance-employer"} {
		if !hubItem(h, k).Task.Done {
			t.Errorf("%s should be done for the newborn family", k)
		}
	}
	for _, k := range []string{"insurance-marketplace", "medicaid-chip", "passport", "bonding-leave"} {
		if it := hubItem(h, k); it.Key == "" || it.Task.Done {
			t.Errorf("%s should be open: %+v", k, it)
		}
	}
	if hubItem(h, "leave-notice").Key != "" {
		t.Error("leave notice belongs before the birth")
	}
	mp := hubItem(h, "insurance-marketplace")
	if mp.Basis != "official" || mp.Task.DueOn == nil || mp.Task.Source == nil || mp.Why == "" || len(mp.How) == 0 {
		t.Errorf("marketplace item = %+v", mp)
	}
	if want := h.AnchorOn.AddDate(0, 0, 60); !mp.Task.DueOn.Time.Equal(want) {
		t.Errorf("marketplace deadline %v, want %v", mp.Task.DueOn.Time, want)
	}
	if len(h.Rights) != 3 || h.StatePointer.Source.Url == "" {
		t.Errorf("rights %d, pointer %+v", len(h.Rights), h.StatePointer)
	}

	// Both parents tick the same item through updateTask; the other parent sees it.
	mpPath := "/api/members/" + marcus.Id.String() + "/tasks/" + mp.Task.Id.String()
	c.Patch(mpPath, map[string]any{"done": true}, http.StatusOK, nil)
	c.Get(hubPath(mom.Id), http.StatusOK, &h)
	if it := hubItem(h, "insurance-marketplace"); !it.Task.Done || it.Task.DoneById == nil || *it.Task.DoneById != marcus.Id {
		t.Errorf("tick not shared: %+v", it.Task)
	}

	// Planning: undated, so the steps have no deadline yet; never empty.
	plan := c.StartDemo("planning")
	var ph httpapi.FamilyPaperwork
	c.Get(hubPath(testutil.Parent(t, plan, httpapi.ParentRoleMother).Id), http.StatusOK, &ph)
	if ph.Phase != "before" || len(ph.Items) != 8 || ph.AnchorOn != nil || hubItem(ph, "leave-notice").Task.DueOn != nil {
		t.Errorf("planning: phase %s items %d", ph.Phase, len(ph.Items))
	}
	// A preschooler: only the steps that still apply.
	pre := c.StartDemo("preschool")
	var lh httpapi.FamilyPaperwork
	c.Get(hubPath(testutil.Parent(t, pre, httpapi.ParentRoleMother).Id), http.StatusOK, &lh)
	if lh.Phase != "later" || len(lh.Items) != 2 {
		t.Errorf("preschool: phase %s items %d", lh.Phase, len(lh.Items))
	}
	// Pregnant: one step done, the rest counted from the due date.
	preg := c.StartDemo("pregnancy")
	var gh httpapi.FamilyPaperwork
	c.Get(hubPath(testutil.Parent(t, preg, httpapi.ParentRoleMother).Id), http.StatusOK, &gh)
	if gh.Phase != "before" || !hubItem(gh, "leave-notice").Task.Done || hubItem(gh, "ssn").Task.Done || gh.AnchorKind == nil || *gh.AnchorKind != "due_date" {
		t.Errorf("pregnancy hub = phase %s, anchor %v", gh.Phase, gh.AnchorKind)
	}
}

func TestFamilyPaperworkIsParentsOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleNanny {
			nanny = cg
		}
	}
	c.Get(hubPath(nanny.Id), http.StatusNotFound, nil)
	c.Post(hubPath(nanny.Id)+"/benefits", map[string]any{"answers": map[string]bool{}}, http.StatusNotFound, nil)

	// Even with family_plan the nanny neither lists nor ticks paperwork.
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{family_plan}' WHERE id = $1`, nanny.Id); err != nil {
		t.Fatal(err)
	}
	for _, it := range taskList(c, nanny.Id, "") {
		if it.Kind == httpapi.TaskKindPaperwork {
			t.Fatalf("caregiver sees paperwork %q", it.Title)
		}
	}
	var h httpapi.FamilyPaperwork
	c.Get(hubPath(mom.Id), http.StatusOK, &h)
	c.Patch("/api/members/"+nanny.Id.String()+"/tasks/"+hubItem(h, "passport").Task.Id.String(), map[string]any{"done": true}, http.StatusNotFound, nil)

	// Another family's session never reaches this family's hub.
	other := testutil.New(t)
	other.StartDemo("newborn")
	other.Get(hubPath(mom.Id), http.StatusNotFound, nil)
}

func TestCheckBenefitsHighlightsWithoutStoring(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var h httpapi.FamilyPaperwork
	c.Get(hubPath(mom.Id), http.StatusOK, &h)
	if !h.Benefits.Household || len(h.Benefits.Questions) != 3 || len(h.Benefits.Programs) != 3 {
		t.Fatalf("finder = %+v", h.Benefits)
	}
	ids := func(r httpapi.BenefitHighlights) map[string]string {
		m := map[string]string{}
		for _, it := range r.Items {
			m[it.ProgramId] = it.Reason
		}
		return m
	}
	var none, tight httpapi.BenefitHighlights
	c.Post(hubPath(mom.Id)+"/benefits", map[string]any{"answers": map[string]bool{}}, http.StatusOK, &none)
	if len(none.Items) != 0 {
		t.Errorf("no answers highlighted %v", none.Items)
	}
	c.Post(hubPath(mom.Id)+"/benefits", map[string]any{"answers": map[string]bool{"food_tight": true, "uninsured": false}}, http.StatusOK, &tight)
	got := ids(tight)
	if got["snap"] == "" || got["wic"] == "" || got["medicaid-chip"] != "" {
		t.Errorf("food_tight highlights = %v", got)
	}
	c.Post(hubPath(mom.Id)+"/benefits", map[string]any{"answers": map[string]bool{"income": true}}, http.StatusBadRequest, nil)

	// Nothing is stored: no table holds the answers.
	var n int
	if err := c.Pool.QueryRow(t.Context(), `SELECT count(*) FROM pg_tables WHERE tablename LIKE '%benefit%'`).Scan(&n); err != nil || n != 0 {
		t.Errorf("benefit tables = %d, err %v", n, err)
	}

	// A planning household has no pregnancy or child under 5, so WIC is not offered.
	plan := c.StartDemo("planning")
	var ph httpapi.FamilyPaperwork
	c.Get(hubPath(testutil.Parent(t, plan, httpapi.ParentRoleMother).Id), http.StatusOK, &ph)
	if ph.Benefits.Household || len(ph.Benefits.Programs) != 2 {
		t.Errorf("planning finder = %+v", ph.Benefits)
	}
}
