package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Completing a manual is recorded for that person only, keeps the first time,
// and an unknown manual is a 404.
func TestManualCompletionIsPerPerson(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mother := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	partner := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRolePartner).Id.String()

	var list httpapi.ManualList
	c.Get(mother+"/manuals", http.StatusOK, &list)
	if len(list.Items) < 3 || list.Items[0].Id != "swaddle" || list.Items[0].CompletedAt != nil || len(list.Items[0].Check) == 0 {
		t.Fatalf("unexpected fresh list: %+v", list)
	}

	var first, again httpapi.Manual
	c.Put(mother+"/manuals/swaddle/completion", nil, http.StatusOK, &first)
	c.Put(mother+"/manuals/swaddle/completion", nil, http.StatusOK, &again)
	if first.CompletedAt == nil || again.CompletedAt == nil || !first.CompletedAt.Equal(*again.CompletedAt) {
		t.Fatalf("completion not kept: %v %v", first.CompletedAt, again.CompletedAt)
	}
	c.Put(mother+"/manuals/nope/completion", nil, http.StatusNotFound, nil)

	c.Get(mother+"/manuals", http.StatusOK, &list)
	if list.Items[0].CompletedAt == nil {
		t.Fatal("mother's completion missing")
	}
	c.Get(partner+"/manuals", http.StatusOK, &list)
	if list.Items[0].CompletedAt != nil {
		t.Fatal("partner sees the mother's completion")
	}
}
