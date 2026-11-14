package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestBudgetIsSharedByBothParentsAndComputed(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := memberPath(testutil.Parent(t, fam, httpapi.ParentRoleMother).Id)
	dad := memberPath(testutil.Parent(t, fam, httpapi.ParentRolePartner).Id)

	var b httpapi.Budget
	c.Get(mom+"/budget", http.StatusOK, &b)
	if len(b.Items) == 0 || b.Total.FirstYearCents <= 0 || len(b.ByPayer) != 3 {
		t.Fatalf("seeded budget missing: %+v", b.Total)
	}
	before := b.Total.FirstYearCents

	// The partner adds a monthly line; it counts twelve times for the mother too.
	var it httpapi.BudgetItem
	c.Post(dad+"/budget-items", map[string]any{"category": "childcare", "name": "Nanny share", "amountCents": 10000, "cadence": "monthly", "payer": "partner"}, http.StatusCreated, &it)
	c.Get(mom+"/budget", http.StatusOK, &b)
	if b.Total.FirstYearCents != before+120000 {
		t.Errorf("first year = %d, want %d", b.Total.FirstYearCents, before+120000)
	}

	// The mother edits the partner's line, then deletes it.
	c.Put(mom+"/budget-items/"+it.Id.String(), map[string]any{"category": "childcare", "name": "Nanny share", "amountCents": 20000, "cadence": "once", "payer": "shared"}, http.StatusOK, &it)
	if it.AmountCents != 20000 {
		t.Errorf("update lost: %+v", it)
	}
	c.Delete(mom+"/budget-items/"+it.Id.String(), http.StatusNoContent, nil)
	c.Delete(mom+"/budget-items/"+it.Id.String(), http.StatusNotFound, nil)
	c.Get(mom+"/budget", http.StatusOK, &b)
	if b.Total.FirstYearCents != before {
		t.Errorf("after delete = %d, want %d", b.Total.FirstYearCents, before)
	}

	// Suggestions skip lines already in the budget.
	for _, s := range b.Suggestions {
		for _, i := range b.Items {
			if s.Name == i.Name {
				t.Errorf("suggestion %q is already in the budget", s.Name)
			}
		}
	}

	// Validation.
	c.Post(mom+"/budget-items", map[string]any{"category": "yachts", "name": "x", "amountCents": 1, "cadence": "once", "payer": "shared"}, http.StatusBadRequest, nil)
	c.Post(mom+"/budget-items", map[string]any{"category": "other", "name": "x", "amountCents": -5, "cadence": "once", "payer": "shared"}, http.StatusBadRequest, nil)
}

func TestMoneyIsForParentsOfThisFamilyOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var b httpapi.Budget
	c.Get(memberPath(mom.Id)+"/budget", http.StatusOK, &b)
	item := b.Items[0].Id.String()
	plan := map[string]any{"deductibleCents": 100000, "outOfPocketMaxCents": 500000, "coinsurancePercent": 20, "alreadyPaidCents": 0}
	budgetItem := map[string]any{"category": "other", "name": "x", "amountCents": 1, "cadence": "once", "payer": "shared"}
	calls := func(m string, status int) {
		t.Helper()
		c.Get(m+"/budget", status, nil)
		c.Post(m+"/budget-items", budgetItem, status, nil)
		c.Put(m+"/budget-items/"+item, budgetItem, status, nil)
		c.Delete(m+"/budget-items/"+item, status, nil)
		c.Get(m+"/birth-cost-plan", status, nil)
		c.Put(m+"/birth-cost-plan", plan, status, nil)
	}
	for _, cg := range fam.Caregivers {
		calls(memberPath(cg.Id), http.StatusNotFound)
	}
	// A second family cannot touch the first family's line, even through its own parent.
	c.StartDemo("pregnancy")
	calls(memberPath(mom.Id), http.StatusNotFound)
	var other httpapi.Family
	c.Get("/api/family", http.StatusOK, &other)
	otherMom := memberPath(testutil.Parent(t, other, httpapi.ParentRoleMother).Id)
	c.Put(otherMom+"/budget-items/"+item, budgetItem, http.StatusNotFound, nil)
	c.Delete(otherMom+"/budget-items/"+item, http.StatusNotFound, nil)
}

func TestBirthCostPlanIsAnEstimate(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := memberPath(testutil.Parent(t, fam, httpapi.ParentRoleMother).Id)
	dad := memberPath(testutil.Parent(t, fam, httpapi.ParentRolePartner).Id)

	var p httpapi.BirthCostPlan
	c.Get(mom+"/birth-cost-plan", http.StatusOK, &p)
	// The demo seeds a typical plan so the screen opens with a range, never blank.
	if p.Input == nil || p.Input.DeductibleCents != 300000 || len(p.Scenarios) != 2 || p.EstimateNote == "" || len(p.Sources) == 0 {
		t.Fatalf("seeded plan: %+v", p)
	}
	c.Put(dad+"/birth-cost-plan", map[string]any{"deductibleCents": 300000, "outOfPocketMaxCents": 800000, "coinsurancePercent": 20, "alreadyPaidCents": 0}, http.StatusOK, &p)
	if len(p.Scenarios) != 2 || p.Scenarios[0].Kind != "vaginal" || p.Scenarios[1].Kind != "cesarean" {
		t.Fatalf("scenarios: %+v", p.Scenarios)
	}
	for _, s := range p.Scenarios {
		if s.Total.HighCents > 800000 || s.Total.LowCents >= s.Total.HighCents {
			t.Errorf("%s range %+v", s.Kind, s.Total)
		}
	}
	// The mother reads what the partner saved.
	c.Get(mom+"/birth-cost-plan", http.StatusOK, &p)
	if p.Input == nil || p.Input.DeductibleCents != 300000 {
		t.Errorf("not shared: %+v", p.Input)
	}
	c.Put(mom+"/birth-cost-plan", map[string]any{"deductibleCents": 900000, "outOfPocketMaxCents": 800000, "coinsurancePercent": 20, "alreadyPaidCents": 0}, http.StatusBadRequest, nil)
	c.Put(mom+"/birth-cost-plan", map[string]any{"deductibleCents": 1, "outOfPocketMaxCents": 800000, "coinsurancePercent": 101, "alreadyPaidCents": 0}, http.StatusBadRequest, nil)
}

func TestEveryDemoFamilyHasAFilledBudget(t *testing.T) {
	for _, tpl := range []string{"planning", "pregnancy", "newborn", "preschool"} {
		c := testutil.New(t)
		fam := c.StartDemo(tpl)
		m := memberPath(testutil.Parent(t, fam, httpapi.ParentRoleMother).Id)
		var b httpapi.Budget
		c.Get(m+"/budget", http.StatusOK, &b)
		if len(b.Items) < 5 {
			t.Errorf("%s: %d budget items", tpl, len(b.Items))
		}
	}
}
