package httpapi_test

// REFERENCE TESTS: every sensitive endpoint gets these four kinds of test:
// validation, privacy between parents, audit, and its effect on the plan.

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func checkin(mood int, vis httpapi.Visibility) httpapi.MoodCheckinInput {
	return httpapi.MoodCheckinInput{Mood: mood, Energy: 3, SleepHours: 6.5, Visibility: vis}
}

func TestMoodCheckinValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/mood-checkins"

	c.Post(path, checkin(9, httpapi.VisibilityPrivate), http.StatusBadRequest, nil)
	c.Post(path, checkin(3, "everyone"), http.StatusBadRequest, nil)
	c.Post(path, map[string]any{"mood": 3}, http.StatusBadRequest, nil)
}

func TestMoodCheckinPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	momPath := "/api/members/" + mom.Id.String() + "/mood-checkins"

	c.Post(momPath, checkin(2, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	c.Post(momPath, checkin(4, httpapi.VisibilityPartner), http.StatusCreated, nil)
	c.Post(momPath, checkin(3, httpapi.VisibilityCareTeam), http.StatusCreated, nil)

	var own, seenByPartner httpapi.MoodCheckinList
	c.Get(momPath, http.StatusOK, &own)
	c.Get("/api/members/"+partner.Id.String()+"/mood-checkins", http.StatusOK, &seenByPartner)
	if len(own.Items) != 3 {
		t.Errorf("author sees %d check-ins, want 3", len(own.Items))
	}
	if len(seenByPartner.Items) != 1 || seenByPartner.Items[0].Visibility != httpapi.VisibilityPartner {
		t.Errorf("partner must see only the shared check-in, got %+v", seenByPartner.Items)
	}
}

func TestMoodCheckinIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/mood-checkins"

	c.Post(path, checkin(3, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	c.Get(path, http.StatusOK, nil)
	if n := c.AuditCount(fam.Id, "create", "mood_checkin"); n != 1 {
		t.Errorf("create audit rows = %d, want 1", n)
	}
	if n := c.AuditCount(fam.Id, "read", "mood_checkin"); n != 1 {
		t.Errorf("read audit rows = %d, want 1", n)
	}
}

func TestLowMoodChangesThePlan(t *testing.T) {
	c := testutil.New(t)
	partner := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRolePartner)
	base := "/api/members/" + partner.Id.String()

	hasLowMood := func() bool {
		var pl httpapi.Plan
		c.Get(base+"/plan", http.StatusOK, &pl)
		for _, it := range pl.Items {
			if it.RuleId == "low-mood-partner" {
				return true
			}
		}
		return false
	}
	for i := range 3 {
		if hasLowMood() {
			t.Fatalf("low-mood item appeared after %d check-ins", i)
		}
		c.Post(base+"/mood-checkins", checkin(1, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	}
	if !hasLowMood() {
		t.Fatal("three low check-ins must add the low-mood item to the partner's plan")
	}
}
