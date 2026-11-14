package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestMilestoneChecklistAndObservations(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	child := "/children/" + fam.Children[0].Id.String() + "/milestones"
	path := "/api/members/" + mom.Id.String() + child
	var list httpapi.MilestoneChecklist
	c.Get(path, http.StatusOK, &list)
	if list.ChecklistAgeMonths != 48 || len(list.Items) != 17 || list.Source.Url == "" {
		t.Fatalf("checklist: %+v", list)
	}
	for _, item := range list.Items {
		if item.Observed {
			t.Fatalf("unexpected observation: %+v", item)
		}
	}
	id := "/4y-language-sentences"
	var item httpapi.Milestone
	c.Put(path+id, map[string]bool{"observed": true}, http.StatusOK, &item)
	if !item.Observed || item.ObservedOn == nil {
		t.Fatalf("saved milestone: %+v", item)
	}
	date := *item.ObservedOn
	c.Post("/api/family/demo-time-skips", nil, http.StatusOK, nil)
	c.Put(path+id, map[string]bool{"observed": true}, http.StatusOK, &item)
	if item.ObservedOn == nil || !item.ObservedOn.Equal(date.Time) {
		t.Fatal("a repeated observation changed its date")
	}
	c.Get("/api/members/"+partner.Id.String()+child, http.StatusOK, &list)
	found := false
	for _, saved := range list.Items {
		if saved.Id == item.Id && saved.Observed {
			found = true
		}
	}
	if !found {
		t.Fatal("second parent cannot see the observation")
	}
	c.Put(path+id, map[string]bool{"observed": false}, http.StatusOK, nil)
	c.Put(path+"/5y-movement-hop", map[string]bool{"observed": true}, http.StatusNotFound, nil)
	if len(fam.Caregivers) > 0 {
		c.Get("/api/members/"+fam.Caregivers[0].Id.String()+child, http.StatusNotFound, nil)
	}
	other := c.StartDemo("preschool")
	otherMom := testutil.Parent(t, other, httpapi.ParentRoleMother)
	c.Get("/api/members/"+otherMom.Id.String()+child, http.StatusNotFound, nil)
}
