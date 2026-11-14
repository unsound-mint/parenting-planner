package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

const childcarePath = "/api/family/childcare-options"

func childcareOption(name string, status httpapi.ChildcareStatus) httpapi.ChildcareOptionInput {
	return httpapi.ChildcareOptionInput{Name: name, Kind: httpapi.ChildcareKindDaycare, Status: status}
}

func TestChildcareOptionValidation(t *testing.T) {
	c := testutil.New(t)
	c.Get(childcarePath, http.StatusUnauthorized, nil)
	c.Post(childcarePath, childcareOption("Sunny Days", httpapi.ChildcareStatusToured), http.StatusUnauthorized, nil)

	c.StartDemo("newborn")
	for name, body := range map[string]map[string]any{
		"no name":         {"kind": "daycare", "status": "toured"},
		"empty name":      {"name": "", "kind": "daycare", "status": "toured"},
		"long name":       {"name": strings.Repeat("x", 121), "kind": "daycare", "status": "toured"},
		"bad kind":        {"name": "Sunny Days", "kind": "camp", "status": "toured"},
		"bad status":      {"name": "Sunny Days", "kind": "daycare", "status": "maybe"},
		"negative cost":   {"name": "Sunny Days", "kind": "daycare", "status": "toured", "monthlyCost": -1},
		"position zero":   {"name": "Sunny Days", "kind": "daycare", "status": "waitlisted", "waitlistPosition": 0},
		"bad date":        {"name": "Sunny Days", "kind": "daycare", "status": "offered", "decideBy": "soon"},
		"long notes":      {"name": "Sunny Days", "kind": "daycare", "status": "toured", "notes": strings.Repeat("x", 2001)},
		"no status":       {"name": "Sunny Days", "kind": "daycare"},
		"long contact":    {"name": "Sunny Days", "kind": "daycare", "status": "toured", "contact": strings.Repeat("x", 301)},
		"fractional cost": {"name": "Sunny Days", "kind": "daycare", "status": "toured", "monthlyCost": 10.5},
	} {
		t.Run(name, func(t *testing.T) { c.Post(childcarePath, body, http.StatusBadRequest, nil) })
	}
	var created httpapi.ChildcareOption
	c.Post(childcarePath, childcareOption("Sunny Days", httpapi.ChildcareStatusToured), http.StatusCreated, &created)
	c.Put(childcarePath+"/"+created.Id.String(), map[string]any{"name": "Sunny Days", "kind": "daycare", "status": "gone"}, http.StatusBadRequest, nil)
	c.Get(childcarePath+"/not-a-uuid", http.StatusBadRequest, nil)
}

func TestChildcareOptionCRUD(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("newborn")

	// The newborn seed tracks three options; count from there.
	var before httpapi.ChildcareOptionList
	c.Get(childcarePath, http.StatusOK, &before)
	if len(before.Items) != 3 {
		t.Fatalf("newborn seed has %d options, want 3", len(before.Items))
	}

	cost, pos := 2100, 4
	applied := openapi_types.Date{Time: testutil.Now.AddDate(0, 0, -30)}
	contact, notes := "Ms. Lee, (617) 555-0111", "Toured on a Tuesday."
	in := httpapi.ChildcareOptionInput{
		Name: "Sunny Days Daycare", Kind: httpapi.ChildcareKindDaycare, Contact: &contact, MonthlyCost: &cost,
		Status: httpapi.ChildcareStatusWaitlisted, WaitlistPosition: &pos, AppliedOn: &applied, Notes: &notes,
	}
	var created httpapi.ChildcareOption
	c.Post(childcarePath, in, http.StatusCreated, &created)
	if created.Name != in.Name || created.Status != httpapi.ChildcareStatusWaitlisted || created.MonthlyCost == nil || *created.MonthlyCost != 2100 ||
		created.WaitlistPosition == nil || *created.WaitlistPosition != 4 || created.AppliedOn == nil || created.AppliedOn.Format("2006-01-02") != applied.Format("2006-01-02") ||
		created.Contact == nil || *created.Contact != contact || created.DecideBy != nil || !created.UpdatedAt.Equal(testutil.Now) {
		t.Errorf("created %+v", created)
	}

	var list httpapi.ChildcareOptionList
	c.Get(childcarePath, http.StatusOK, &list)
	if len(list.Items) != 4 || list.Items[0].Id != created.Id {
		t.Errorf("list has %d items, first %v; want 4 with the new one first", len(list.Items), list.Items[0].Id)
	}

	one := childcarePath + "/" + created.Id.String()
	var got httpapi.ChildcareOption
	c.Get(one, http.StatusOK, &got)
	if got.Id != created.Id || got.Name != created.Name {
		t.Errorf("get = %+v", got)
	}

	// A full replace: fields left out are cleared.
	var updated httpapi.ChildcareOption
	c.Put(one, httpapi.ChildcareOptionInput{Name: "Sunny Days Daycare", Kind: httpapi.ChildcareKindDaycare, Status: httpapi.ChildcareStatusOffered, MonthlyCost: &cost}, http.StatusOK, &updated)
	if updated.Status != httpapi.ChildcareStatusOffered || updated.WaitlistPosition != nil || updated.Notes != nil || updated.Contact != nil || updated.MonthlyCost == nil {
		t.Errorf("updated %+v", updated)
	}

	c.Delete(one, http.StatusNoContent, nil)
	c.Get(one, http.StatusNotFound, nil)
	c.Put(one, childcareOption("x", httpapi.ChildcareStatusToured), http.StatusNotFound, nil)
	c.Delete(one, http.StatusNotFound, nil)
	c.Get(childcarePath, http.StatusOK, &list)
	if len(list.Items) != 3 {
		t.Errorf("after delete %d options, want 3", len(list.Items))
	}
}

func TestChildcareOptionsStayInTheFamily(t *testing.T) {
	a := testutil.New(t)
	a.StartDemo("newborn")
	var mine httpapi.ChildcareOption
	a.Post(childcarePath, childcareOption("Sunny Days", httpapi.ChildcareStatusToured), http.StatusCreated, &mine)
	one := childcarePath + "/" + mine.Id.String()

	b := testutil.New(t)
	b.StartDemo("newborn")
	var theirs httpapi.ChildcareOptionList
	b.Get(childcarePath, http.StatusOK, &theirs)
	for _, o := range theirs.Items {
		if o.Id == mine.Id {
			t.Fatal("another family sees this family's option")
		}
	}
	b.Get(one, http.StatusNotFound, nil)
	b.Put(one, childcareOption("Taken over", httpapi.ChildcareStatusDeclined), http.StatusNotFound, nil)
	b.Delete(one, http.StatusNotFound, nil)

	var still httpapi.ChildcareOption
	a.Get(one, http.StatusOK, &still)
	if still.Name != "Sunny Days" || still.Status != httpapi.ChildcareStatusToured {
		t.Errorf("the other family changed it: %+v", still)
	}

	// A family without the seed starts empty.
	p := testutil.New(t)
	p.StartDemo("pregnancy")
	var empty httpapi.ChildcareOptionList
	p.Get(childcarePath, http.StatusOK, &empty)
	if len(empty.Items) != 0 {
		t.Errorf("pregnancy family has %d options, want 0", len(empty.Items))
	}
}

func childcarePlanItem(t *testing.T, c *testutil.Client, memberID string) *httpapi.PlanItem {
	t.Helper()
	var plan httpapi.Plan
	c.Get("/api/members/"+memberID+"/plan", http.StatusOK, &plan)
	for _, it := range plan.Items {
		if it.RuleId == "childcare-decision" {
			return &it
		}
	}
	return nil
}

func TestChildcareDeadlineChangesThePlan(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	dad := testutil.Parent(t, fam, httpapi.ParentRolePartner).Id.String()

	// The seeded offer is due in 10 days: upcoming on both parents' plans.
	for _, id := range []string{mom, dad} {
		it := childcarePlanItem(t, c, id)
		if it == nil || it.Status != httpapi.PlanItemStatusUpcoming || it.DueBy == nil || it.DueBy.Format("2006-01-02") != testutil.Now.AddDate(0, 0, 10).Format("2006-01-02") ||
			!strings.Contains(it.Reason, "Little Harbor Early Learning") || it.Category != httpapi.PlanCategoryLogistics || it.Source.Url == "" {
			t.Fatalf("seeded plan item for %s = %+v", id, it)
		}
	}

	var list httpapi.ChildcareOptionList
	c.Get(childcarePath, http.StatusOK, &list)
	var offered httpapi.ChildcareOption
	for _, o := range list.Items {
		if o.Status == httpapi.ChildcareStatusOffered {
			offered = o
		}
	}
	one := childcarePath + "/" + offered.Id.String()
	input := func(status httpapi.ChildcareStatus, days int) httpapi.ChildcareOptionInput {
		in := httpapi.ChildcareOptionInput{Name: offered.Name, Kind: offered.Kind, Status: status}
		if days != 0 {
			in.DecideBy = &openapi_types.Date{Time: testutil.Now.AddDate(0, 0, days)}
		}
		return in
	}

	// Accepting it takes the item off both plans.
	c.Put(one, input(httpapi.ChildcareStatusAccepted, 10), http.StatusOK, nil)
	if it := childcarePlanItem(t, c, mom); it != nil {
		t.Fatalf("accepted offer still on the plan: %+v", it)
	}

	// A new offer due in 3 days appears as due.
	var sunny httpapi.ChildcareOption
	c.Post(childcarePath, input(httpapi.ChildcareStatusOffered, 3), http.StatusCreated, &sunny)
	if it := childcarePlanItem(t, c, dad); it == nil || it.Status != httpapi.PlanItemStatusDue {
		t.Fatalf("offer due in 3 days: plan item %+v, want due", it)
	}

	// A passed date is overdue; deleting the option removes the item.
	c.Put(childcarePath+"/"+sunny.Id.String(), input(httpapi.ChildcareStatusOffered, -2), http.StatusOK, nil)
	if it := childcarePlanItem(t, c, mom); it == nil || it.Status != httpapi.PlanItemStatusOverdue {
		t.Fatalf("passed date: plan item %+v, want overdue", it)
	}
	c.Delete(childcarePath+"/"+sunny.Id.String(), http.StatusNoContent, nil)
	if it := childcarePlanItem(t, c, mom); it != nil {
		t.Fatalf("deleted offer still on the plan: %+v", it)
	}
}
