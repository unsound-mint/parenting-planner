package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestWeeklyReadsFollowTheFamilyClock(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/weekly-reads"
	var list httpapi.WeeklyReadList
	c.Get(path, http.StatusOK, &list)
	if len(list.Items) != 40 {
		t.Fatalf("%d pregnancy reads, want 40", len(list.Items))
	}
	cur := list.Items[list.Current]
	if cur.Kind != httpapi.WeeklyReadKindPregnancyWeek || cur.N != *fam.GestationalWeek || cur.Label == "" || cur.Title == "" || len(cur.Sources) == 0 || cur.StartsOn == nil {
		t.Fatalf("current read = %+v, family week %d", cur, *fam.GestationalWeek)
	}
	c.Post("/api/family/demo-time-skips", nil, http.StatusOK, nil)
	c.Get(path, http.StatusOK, &list)
	if next := list.Items[list.Current]; next.N != cur.N+1 {
		t.Fatalf("after a skipped week the read is week %d, want %d", next.N, cur.N+1)
	}
	// Caregivers do not get the reads.
	if len(fam.Caregivers) > 0 {
		c.Get("/api/members/"+fam.Caregivers[0].Id.String()+"/weekly-reads", http.StatusNotFound, nil)
	}
}

func TestWeeklyReadsFollowTheChildAge(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var list httpapi.WeeklyReadList
	c.Get("/api/members/"+mom.Id.String()+"/weekly-reads", http.StatusOK, &list)
	cur := list.Items[list.Current]
	if cur.Kind != httpapi.WeeklyReadKindYear || cur.N != fam.Children[0].AgeMonths/12 {
		t.Fatalf("current read = %s %d, child %d months", cur.Kind, cur.N, fam.Children[0].AgeMonths)
	}
	if list.Items[0].Kind != httpapi.WeeklyReadKindBabyWeek || list.Items[0].N != 0 {
		t.Fatalf("track starts with %s %d", list.Items[0].Kind, list.Items[0].N)
	}
}
