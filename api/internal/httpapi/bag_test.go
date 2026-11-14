package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestBagHasThreeListsWithOwners(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/family/bag-items", http.StatusUnauthorized, nil)
	c.StartDemo("pregnancy")
	var l httpapi.BagItemList
	c.Get("/api/family/bag-items", http.StatusOK, &l)
	lists, owned := map[httpapi.BagList]int{}, 0
	for _, i := range l.Items {
		lists[i.List]++
		if i.OwnerMemberId != nil {
			owned++
		}
	}
	if len(lists) != 3 || owned == 0 || owned == len(l.Items) {
		t.Errorf("want 3 lists with some owned and some open items, got %v owned=%d of %d", lists, owned, len(l.Items))
	}
}

func TestBagItemsCanBeAddedAssignedAndPacked(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	jake := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var item httpapi.BagItem
	c.Post("/api/family/bag-items", map[string]any{"list": "baby", "label": "Swaddle"}, http.StatusCreated, &item)
	if item.OwnerMemberId != nil || item.Packed {
		t.Fatalf("new item must be open: %+v", item)
	}
	var got httpapi.BagItem
	c.Patch("/api/family/bag-items/"+item.Id.String(), map[string]any{"ownerMemberId": jake.Id, "packed": true}, http.StatusOK, &got)
	if got.OwnerMemberId == nil || *got.OwnerMemberId != jake.Id || !got.Packed {
		t.Errorf("update not applied: %+v", got)
	}
	// Changing only the owner keeps packed.
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Patch("/api/family/bag-items/"+item.Id.String(), map[string]any{"ownerMemberId": mom.Id}, http.StatusOK, &got)
	if *got.OwnerMemberId != mom.Id || !got.Packed {
		t.Errorf("owner change must keep packed: %+v", got)
	}
}

func TestBagValidationAndFamilyScope(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	var l httpapi.BagItemList
	c.Get("/api/family/bag-items", http.StatusOK, &l)
	foreignOwner := testutil.Parent(t, first, httpapi.ParentRoleMother).Id
	foreignItem := l.Items[0].Id

	c.StartDemo("pregnancy") // the client now holds the second family's session
	c.Post("/api/family/bag-items", map[string]any{"list": "car", "label": "x"}, http.StatusBadRequest, nil)
	c.Post("/api/family/bag-items", map[string]any{"list": "baby", "label": ""}, http.StatusBadRequest, nil)
	c.Post("/api/family/bag-items", map[string]any{"list": "baby", "label": "x", "ownerMemberId": foreignOwner}, http.StatusBadRequest, nil)
	c.Patch("/api/family/bag-items/"+foreignItem.String(), map[string]any{"packed": true}, http.StatusNotFound, nil)
	var mine httpapi.BagItemList
	c.Get("/api/family/bag-items", http.StatusOK, &mine)
	for _, i := range mine.Items {
		if i.Id == foreignItem {
			t.Error("another family's item is visible")
		}
	}
}
