package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func paperworkByKey(c *testutil.Client) map[httpapi.PaperworkKey]httpapi.PaperworkItem {
	var l httpapi.PaperworkList
	c.Get("/api/family/paperwork", http.StatusOK, &l)
	m := map[httpapi.PaperworkKey]httpapi.PaperworkItem{}
	for _, i := range l.Items {
		m[i.Key] = i
	}
	return m
}

func TestPaperworkDeadlinesComeFromTheDueDate(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/family/paperwork", http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	before := paperworkByKey(c)
	if len(before) != 3 {
		t.Fatalf("want 3 items, got %d", len(before))
	}
	for k, it := range before {
		if it.Source.Url == "" || it.Deadline == nil || it.DeadlineBasedOn == nil || *it.DeadlineBasedOn != httpapi.DueDate {
			t.Errorf("%s: want a source and a due-date deadline, got %+v", k, it)
		}
	}
	due := fam.DueDate.Time
	if want := due.AddDate(0, 0, -30); !before["leave-notice"].Deadline.Time.Equal(want) {
		t.Errorf("leave notice = %v, want %v", before["leave-notice"].Deadline.Time, want)
	}

	// Moving the due date by two weeks moves every deadline by two weeks.
	var moved httpapi.Family
	c.Patch("/api/family", map[string]any{"dueDate": due.AddDate(0, 0, 14).Format("2006-01-02")}, http.StatusOK, &moved)
	after := paperworkByKey(c)
	for k := range before {
		if d := after[k].Deadline.Time.Sub(before[k].Deadline.Time); d != 14*24*time.Hour {
			t.Errorf("%s moved by %v, want 14 days", k, d)
		}
	}
	if moved.GestationalWeek == nil || *moved.GestationalWeek != 23 {
		t.Errorf("week = %v, want 23 after moving the due date two weeks later", moved.GestationalWeek)
	}
}

func TestPaperworkCanBeDoneAndAssigned(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	jake := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var it httpapi.PaperworkItem
	c.Patch("/api/family/paperwork/baby-health-insurance", map[string]any{"ownerMemberId": jake.Id}, http.StatusOK, &it)
	if it.OwnerMemberId == nil || *it.OwnerMemberId != jake.Id || it.Done {
		t.Fatalf("assign: %+v", it)
	}
	c.Patch("/api/family/paperwork/baby-health-insurance", map[string]any{"done": true}, http.StatusOK, &it)
	if !it.Done || it.Status != httpapi.PaperworkItemStatusDone || it.OwnerMemberId == nil {
		t.Errorf("done must keep the owner: %+v", it)
	}
	if got := paperworkByKey(c)["baby-health-insurance"]; !got.Done {
		t.Error("done not stored")
	}
}

func TestPaperworkValidationAndScope(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	foreign := testutil.Parent(t, first, httpapi.ParentRoleMother).Id
	c.StartDemo("pregnancy")
	c.Patch("/api/family/paperwork/not-an-item", map[string]any{"done": true}, http.StatusBadRequest, nil)
	c.Patch("/api/family/paperwork/leave-notice", map[string]any{"ownerMemberId": foreign}, http.StatusBadRequest, nil)
	c.Patch("/api/family", map[string]any{"dueDate": "2031-01-01"}, http.StatusBadRequest, nil)
	c.Patch("/api/family", map[string]any{"dueDate": "garbage"}, http.StatusBadRequest, nil)
	if paperworkByKey(c)["leave-notice"].Done {
		t.Error("another family's state leaked")
	}
}
