package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func loadMapPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/load-map" }

func areaOf(m httpapi.LoadMap, key httpapi.LoadMapAreaKey) (httpapi.LoadMapArea, bool) {
	for _, a := range m.Areas {
		if a.Key == key {
			return a, true
		}
	}
	return httpapi.LoadMapArea{}, false
}

func countFor(shares []httpapi.LoadMapShare, id uuid.UUID) int {
	for _, s := range shares {
		if s.MemberId == id {
			return s.Count
		}
	}
	return 0
}

func TestLoadMapCountsTasksAndHandsOverOnlyOnAccept(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get(loadMapPath(uuid.New()), http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var m httpapi.LoadMap
	c.Get(loadMapPath(mom.Id), http.StatusOK, &m)
	if m.WindowDays != 14 || len(m.Areas) == 0 {
		t.Fatalf("map = %+v", m)
	}
	appts, ok := areaOf(m, httpapi.LoadMapAreaKeyAppointments)
	if !ok || countFor(appts.Owned, mom.Id) != 3 || countFor(appts.Owned, jake.Id) != 0 {
		t.Fatalf("appointments = %+v", appts)
	}
	if appts.Started == nil || countFor(*appts.Started, mom.Id) != 3 {
		t.Errorf("task areas say who remembered them: %+v", appts.Started)
	}
	if len(appts.HandoverTaskIds) != 3 {
		t.Errorf("Emily can hand over her 3 appointment tasks, got %d", len(appts.HandoverTaskIds))
	}
	// The partner sees the same counts but has nothing of his own to hand over here.
	var jm httpapi.LoadMap
	c.Get(loadMapPath(jake.Id), http.StatusOK, &jm)
	ja, _ := areaOf(jm, httpapi.LoadMapAreaKeyAppointments)
	if countFor(ja.Owned, mom.Id) != 3 || len(ja.HandoverTaskIds) != 0 {
		t.Errorf("partner view = %+v", ja)
	}
	// Done work in the window still counts: the crib Jake ordered.
	shop, _ := areaOf(m, httpapi.LoadMapAreaKeyShopping)
	if countFor(shop.Owned, jake.Id) != 2 || countFor(*shop.Started, mom.Id) != 2 {
		t.Errorf("shopping = %+v", shop)
	}
	for _, a := range m.Areas {
		if a.Key == httpapi.LoadMapAreaKeyHospitalBag && countFor(a.Owned, mom.Id) != 4 {
			t.Errorf("bag = %+v", a)
		}
	}

	// Offering moves nothing. The car seat is already offered by Emily to Jake.
	planning, _ := areaOf(m, httpapi.LoadMapAreaKeyPlanning)
	if len(planning.OfferedByMeTaskIds) != 1 || countFor(planning.Owned, mom.Id) != 1 {
		t.Fatalf("planning = %+v", planning)
	}
	jp, _ := areaOf(jm, httpapi.LoadMapAreaKeyPlanning)
	if len(jp.OfferedToMeTaskIds) != 1 {
		t.Fatalf("Jake has an offer waiting: %+v", jp)
	}
	var task httpapi.Task
	c.Post(tasksPath(jake.Id)+"/"+jp.OfferedToMeTaskIds[0].String()+"/reassignment/accept", nil, http.StatusOK, &task)
	c.Get(loadMapPath(mom.Id), http.StatusOK, &m)
	planning, _ = areaOf(m, httpapi.LoadMapAreaKeyPlanning)
	if countFor(planning.Owned, jake.Id) != 1 || countFor(planning.Owned, mom.Id) != 0 || len(planning.OfferedByMeTaskIds) != 0 {
		t.Errorf("after accepting, planning = %+v", planning)
	}
}

func TestLoadMapNewbornShowsCareSplitAndNoHandoverForCare(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	aisha, marcus := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var m httpapi.LoadMap
	c.Get(loadMapPath(marcus.Id), http.StatusOK, &m)
	nights, ok := areaOf(m, httpapi.LoadMapAreaKeyNights)
	if !ok {
		t.Fatalf("no nights area: %+v", m.Areas)
	}
	var recent, all int
	for _, s := range nights.Owned {
		if s.MemberId == marcus.Id {
			all, recent = s.Count, *s.RecentCount
		}
	}
	// Marcus did 2 night feeds a night this week and 1 the week before.
	if recent <= all-recent || recent == 0 {
		t.Errorf("Marcus has picked up nights this week: %d of %d are recent", recent, all)
	}
	if nights.Started != nil || len(nights.HandoverTaskIds) != 0 {
		t.Errorf("care areas have no started list and cannot be handed over: %+v", nights)
	}
	if _, ok := areaOf(m, httpapi.LoadMapAreaKeyFeeding); !ok {
		t.Error("no feeding area")
	}
	if _, ok := areaOf(m, httpapi.LoadMapAreaKeyPaperwork); !ok {
		t.Error("no paperwork area")
	}
	_ = aisha
}

func TestLoadMapIsForParentsOfTheFamily(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	for _, cg := range fam.Caregivers {
		c.Get(loadMapPath(cg.Id), http.StatusForbidden, nil)
	}
	// Another family's session cannot read this family's map.
	other := testutil.New(t)
	other.StartDemo("pregnancy")
	other.Get(loadMapPath(testutil.Parent(t, fam, httpapi.ParentRoleMother).Id), http.StatusNotFound, nil)
}
