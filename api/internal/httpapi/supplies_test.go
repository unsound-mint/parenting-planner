package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func suppliesBase(id uuid.UUID) string { return "/api/members/" + id.String() }

func getSupplies(c *testutil.Client, id uuid.UUID) httpapi.Supplies {
	var s httpapi.Supplies
	c.Get(suppliesBase(id)+"/supplies", http.StatusOK, &s)
	return s
}

func findItem(s httpapi.Supplies, name string) httpapi.SupplyItem {
	for _, it := range s.Items {
		if it.Name == name {
			return it
		}
	}
	return httpapi.SupplyItem{}
}

func TestSuppliesSeedShowsOneLowItemFirstAndASizeSuggestion(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	s := getSupplies(c, p.mom.Id)
	if len(s.Items) < 5 || s.Items[0].Name != "Diapers" || s.Items[0].Status != httpapi.RunningLow {
		t.Fatalf("the low item comes first: %+v", s.Items)
	}
	low := 0
	for _, it := range s.Items {
		if it.Status != httpapi.Stocked {
			low++
		}
	}
	if low != 1 {
		t.Errorf("exactly one item is low in the seed, got %d", low)
	}
	d := s.Items[0]
	if d.DaysLeft == nil || d.UsagePerDay == nil || !d.OnShoppingList {
		t.Errorf("diapers are counted from the care log and are on the list: %+v", d)
	}
	if s.Sizes == nil || s.Sizes.Clothing == "" || s.Sizes.Note == "" || s.Sizes.AgeMonths != 1 {
		t.Errorf("sizes = %+v", s.Sizes)
	}
	// Formula has one logged bottle in the seed: not enough for an estimate.
	if f := findItem(s, "Infant formula"); f.DaysLeft != nil {
		t.Errorf("no estimate from fewer than 3 events: %+v", f)
	}
}

func TestSupplyItemsValidateAndCaregiversCannotEdit(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	base := suppliesBase(p.mom.Id)
	c.Post(base+"/supply-items", map[string]any{"name": "x"}, http.StatusBadRequest, nil)
	c.Post(base+"/supply-items", map[string]any{"name": "x", "category": "toys", "quantity": 1}, http.StatusBadRequest, nil)
	c.Post(base+"/supply-items", map[string]any{"name": "x", "category": "other", "quantity": -1}, http.StatusBadRequest, nil)
	var made httpapi.SupplyItem
	c.Post(base+"/supply-items", map[string]any{"name": "Saline drops", "category": "medicine", "quantity": 0}, http.StatusCreated, &made)
	if made.Status != httpapi.Empty || made.Unit != "pcs" || made.PerUse != 1 {
		t.Errorf("created = %+v", made)
	}
	c.Patch(base+"/supply-items/"+made.Id.String(), map[string]any{"name": "Saline drops", "category": "medicine", "quantity": 4}, http.StatusOK, &made)
	if made.Quantity != 4 || made.Status != httpapi.Stocked {
		t.Errorf("updated = %+v", made)
	}
	c.Patch(base+"/supply-items/"+uuid.NewString(), map[string]any{"name": "a", "category": "other", "quantity": 1}, http.StatusNotFound, nil)

	g := suppliesBase(p.grandma.Id)
	c.Post(g+"/supply-items", map[string]any{"name": "Toy", "category": "other", "quantity": 1}, http.StatusForbidden, nil)
	c.Patch(g+"/supply-items/"+made.Id.String(), map[string]any{"name": "a", "category": "other", "quantity": 1}, http.StatusForbidden, nil)
	c.Delete(g+"/supply-items/"+made.Id.String(), http.StatusForbidden, nil)
	c.Delete(base+"/supply-items/"+made.Id.String(), http.StatusNoContent, nil)
	c.Delete(base+"/supply-items/"+made.Id.String(), http.StatusNotFound, nil)
	testutil.New(t).Get(base+"/supplies", http.StatusUnauthorized, nil)
}

func TestShoppingListIsSharedAndTickingRestocks(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	before := getSupplies(c, p.mom.Id)
	diapers := findItem(before, "Diapers")
	var row httpapi.ShoppingItem
	for _, r := range before.Shopping {
		if r.SupplyItemId != nil && *r.SupplyItemId == diapers.Id {
			row = r
		}
	}
	if row.Id == uuid.Nil || row.Done {
		t.Fatalf("seed has an open diapers row: %+v", before.Shopping)
	}
	// Adding the same item again returns the open row.
	var again httpapi.ShoppingItem
	c.Post(suppliesBase(p.mom.Id)+"/shopping-items", map[string]any{"name": "Diapers", "supplyItemId": diapers.Id}, http.StatusCreated, &again)
	if again.Id != row.Id {
		t.Error("a second open row for the same item must not be created")
	}
	c.Post(suppliesBase(p.mom.Id)+"/shopping-items", map[string]any{"name": "x", "supplyItemId": uuid.NewString()}, http.StatusNotFound, nil)
	c.Post(suppliesBase(p.mom.Id)+"/shopping-items", map[string]any{"name": ""}, http.StatusBadRequest, nil)

	// A caregiver ticks it: the stock goes up once, and the tick is audited.
	var done httpapi.ShoppingItem
	tick := suppliesBase(p.grandma.Id) + "/shopping-items/" + row.Id.String()
	c.Patch(tick, map[string]any{"done": true}, http.StatusOK, &done)
	c.Patch(tick, map[string]any{"done": true}, http.StatusOK, nil)
	after := getSupplies(c, p.partner.Id)
	if got := findItem(after, "Diapers"); got.Quantity != diapers.Quantity+40 || got.Status != httpapi.Stocked {
		t.Errorf("restocked once: %d -> %d (%s)", diapers.Quantity, got.Quantity, got.Status)
	}
	if !done.Done || done.DoneById == nil || *done.DoneById != p.grandma.Id {
		t.Errorf("done = %+v", done)
	}
	if n := c.AuditCount(p.fam.Id, "update", "shopping_item"); n != 1 {
		t.Errorf("a caregiver's tick is audited once: %d", n)
	}
	c.Patch(suppliesBase(p.mom.Id)+"/shopping-items/"+row.Id.String(), map[string]any{"done": false}, http.StatusOK, nil)
	if got := findItem(getSupplies(c, p.mom.Id), "Diapers"); got.Quantity != diapers.Quantity {
		t.Errorf("unticking takes the restock back: %d", got.Quantity)
	}
	c.Delete(suppliesBase(p.grandma.Id)+"/shopping-items/"+row.Id.String(), http.StatusForbidden, nil)
	c.Delete(suppliesBase(p.mom.Id)+"/shopping-items/"+row.Id.String(), http.StatusNoContent, nil)
	c.Patch(tick, map[string]any{"done": true}, http.StatusNotFound, nil)
}

func TestCaregiverWithoutCareLogCannotUseSupplies(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{schedule}' WHERE id = $1`, p.nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(suppliesBase(p.nanny.Id)+"/supplies", http.StatusForbidden, nil)
	c.Post(suppliesBase(p.nanny.Id)+"/shopping-items", map[string]any{"name": "Milk"}, http.StatusForbidden, nil)
}
