package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// The history view asks for check-ins since a day months back. The default list
// stays at 30 days, and a longer window never widens what a parent may read.
func TestMoodCheckinHistorySince(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	momPath := "/api/members/" + mom.Id.String() + "/mood-checkins"
	partnerPath := "/api/members/" + partner.Id.String() + "/mood-checkins"
	monthAgo := testutil.Now.AddDate(0, 0, -30)
	since := "?since=" + testutil.Now.AddDate(0, -7, 0).Format(time.DateOnly)

	var recent, history httpapi.MoodCheckinList
	c.Get(momPath, http.StatusOK, &recent)
	c.Get(momPath+since, http.StatusOK, &history)
	for _, it := range recent.Items {
		if it.RecordedAt.Before(monthAgo) {
			t.Fatalf("default list reaches back to %s", it.RecordedAt)
		}
	}
	older := 0
	for _, it := range history.Items {
		if it.RecordedAt.Before(monthAgo) {
			older++
		}
		// The partner keeps his check-ins private, old ones included.
		if it.AuthorId == partner.Id {
			t.Fatalf("mother reads the partner's private check-in from %s", it.RecordedAt)
		}
	}
	if older == 0 || len(history.Items) <= len(recent.Items) {
		t.Fatalf("since returned %d items (%d older than a month), default %d", len(history.Items), older, len(recent.Items))
	}

	var partnerHistory httpapi.MoodCheckinList
	c.Get(partnerPath+since, http.StatusOK, &partnerHistory)
	ownOld := 0
	for _, it := range partnerHistory.Items {
		if it.AuthorId == partner.Id && it.RecordedAt.Before(monthAgo) {
			ownOld++
		}
		if it.AuthorId != partner.Id && it.Visibility != httpapi.VisibilityPartner && it.Visibility != httpapi.VisibilityFamily {
			t.Fatalf("partner reads a %s check-in", it.Visibility)
		}
	}
	if ownOld == 0 {
		t.Fatal("partner does not get his own older check-ins")
	}

	var none httpapi.MoodCheckinList
	c.Get(momPath+"?since="+testutil.Now.AddDate(0, 0, 1).Format(time.DateOnly), http.StatusOK, &none)
	if len(none.Items) != 0 {
		t.Fatalf("a day after today returned %d check-ins", len(none.Items))
	}
	c.Get(momPath+"?since=last-year", http.StatusBadRequest, nil)
}

// A first recorded months ago can be moved to the right day or removed from the
// timeline, by either parent; days outside the child's life are refused.
func TestMilestoneTimelineEditAndDelete(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	child := "/children/" + fam.Children[0].Id.String() + "/milestones"
	momPath := "/api/members/" + mom.Id.String() + child
	partnerPath := "/api/members/" + partner.Id.String() + child
	born := fam.Children[0].BirthDate.Time

	var list httpapi.MilestoneChecklist
	c.Get(momPath, http.StatusOK, &list)
	if len(list.Recorded) < 5 {
		t.Fatalf("seeded timeline: %+v", list.Recorded)
	}
	for i := 1; i < len(list.Recorded); i++ {
		if list.Recorded[i].ObservedOn.After(list.Recorded[i-1].ObservedOn.Time) {
			t.Fatalf("timeline is not newest first: %+v", list.Recorded)
		}
	}
	old := list.Recorded[len(list.Recorded)-1]
	if old.ChecklistAgeMonths >= list.ChecklistAgeMonths {
		t.Fatalf("oldest first should come from an earlier checklist: %+v", old)
	}

	// The partner moves the oldest first to a different day.
	day := born.AddDate(1, 0, 0).Format(time.DateOnly)
	var saved httpapi.Milestone
	c.Put(partnerPath+"/"+old.Id, map[string]any{"observed": true, "observedOn": day}, http.StatusOK, &saved)
	if saved.ObservedOn == nil || saved.ObservedOn.Format(time.DateOnly) != day {
		t.Fatalf("moved first: %+v", saved)
	}
	// Ticking again without a day keeps the day it has.
	c.Put(momPath+"/"+old.Id, map[string]any{"observed": true}, http.StatusOK, &saved)
	if saved.ObservedOn == nil || saved.ObservedOn.Format(time.DateOnly) != day {
		t.Fatalf("a repeated tick moved the day: %+v", saved)
	}
	// A day in the future or before birth is refused, and nothing changes.
	c.Put(momPath+"/"+old.Id, map[string]any{"observed": true, "observedOn": testutil.Now.AddDate(0, 0, 2).Format(time.DateOnly)}, http.StatusBadRequest, nil)
	c.Put(momPath+"/"+old.Id, map[string]any{"observed": true, "observedOn": born.AddDate(0, 0, -1).Format(time.DateOnly)}, http.StatusBadRequest, nil)

	// A first not ticked before can be recorded on a past day.
	c.Put(momPath+"/3y-language-clear", map[string]any{"observed": true, "observedOn": born.AddDate(3, 0, 0).Format(time.DateOnly)}, http.StatusOK, nil)

	// Removing one takes it off both parents' timelines.
	c.Put(momPath+"/"+old.Id, map[string]any{"observed": false}, http.StatusOK, nil)
	var after httpapi.MilestoneChecklist
	c.Get(partnerPath, http.StatusOK, &after)
	found, added := false, false
	for _, r := range after.Recorded {
		found = found || r.Id == old.Id
		added = added || r.Id == "3y-language-clear"
	}
	if found || !added || len(after.Recorded) != len(list.Recorded) {
		t.Fatalf("after edit: %+v", after.Recorded)
	}
	if n := c.AuditCount(fam.Id, "delete", "child_milestone"); n != 1 {
		t.Errorf("delete audit rows = %d, want 1", n)
	}

	// Unknown ids stay 404; so does a family that is not yours.
	c.Put(momPath+"/no-such-milestone", map[string]any{"observed": true}, http.StatusNotFound, nil)
	other := testutil.Parent(t, c.StartDemo("preschool"), httpapi.ParentRoleMother)
	c.Put("/api/members/"+other.Id.String()+child+"/"+list.Recorded[0].Id, map[string]any{"observed": false}, http.StatusNotFound, nil)
}
