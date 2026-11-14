package httpapi_test

// REFERENCE TESTS: every sensitive endpoint gets these four kinds of test:
// validation, privacy between parents, audit, and its effect on the plan.

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

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

func entry(body string, vis httpapi.Visibility) httpapi.DiaryEntryInput {
	return httpapi.DiaryEntryInput{Body: body, Visibility: vis}
}

func diaryBodies(c *testutil.Client, member httpapi.Parent) []string {
	var l httpapi.DiaryEntryList
	c.Get("/api/members/"+member.Id.String()+"/diary-entries", http.StatusOK, &l)
	out := []string{}
	for _, e := range l.Items {
		out = append(out, e.Body)
	}
	return out
}

func contains(xs []string, s string) bool {
	for _, x := range xs {
		if x == s {
			return true
		}
	}
	return false
}

func TestDiaryEntryValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/diary-entries"

	c.Post(path, entry("", httpapi.VisibilityPrivate), http.StatusBadRequest, nil)
	c.Post(path, entry("hi", "everyone"), http.StatusBadRequest, nil)
	c.Post(path, map[string]any{"body": "no visibility chosen"}, http.StatusBadRequest, nil)
	c.Post(path, entry(strings.Repeat("a", 5001), httpapi.VisibilityPrivate), http.StatusBadRequest, nil)

	var e httpapi.DiaryEntry
	c.Post(path, entry("ok", httpapi.VisibilityPrivate), http.StatusCreated, &e)
	c.Patch(path+"/"+e.Id.String(), map[string]any{}, http.StatusBadRequest, nil)
	c.Patch(path+"/"+e.Id.String(), map[string]any{"visibility": "everyone"}, http.StatusBadRequest, nil)
}

// The demo seed gives each parent a private entry and Emily one entry shared with Jake.
func TestDiaryPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	momPath := "/api/members/" + mom.Id.String() + "/diary-entries"

	c.Post(momPath, entry("private note", httpapi.VisibilityPrivate), http.StatusCreated, nil)
	c.Post(momPath, entry("for my psychologist", httpapi.VisibilityCareTeam), http.StatusCreated, nil)
	c.Post(momPath, entry("for Jake", httpapi.VisibilityPartner), http.StatusCreated, nil)

	own, seenByPartner := diaryBodies(c, mom), diaryBodies(c, partner)
	if len(own) != 5 {
		t.Errorf("author sees %d entries, want 5 (2 seeded + 3 new): %q", len(own), own)
	}
	for _, hidden := range []string{"private note", "for my psychologist"} {
		if contains(seenByPartner, hidden) {
			t.Errorf("partner must not see %q", hidden)
		}
	}
	if !contains(seenByPartner, "for Jake") {
		t.Error("partner must see the entry shared with them")
	}
	// Jake's own private seeded entry and Emily's two shared ones.
	if len(seenByPartner) != 3 {
		t.Errorf("partner sees %d entries, want 3: %q", len(seenByPartner), seenByPartner)
	}
}

func TestDiarySharingNeedsTheAuthor(t *testing.T) {
	c := testutil.New(t)
	other := c.StartDemo("pregnancy")
	var strangerEntry httpapi.DiaryEntry
	strangerMom := testutil.Parent(t, other, httpapi.ParentRoleMother)
	c.Post("/api/members/"+strangerMom.Id.String()+"/diary-entries", entry("other family", httpapi.VisibilityFamily), http.StatusCreated, &strangerEntry)

	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	momPath := "/api/members/" + mom.Id.String() + "/diary-entries"
	partnerPath := "/api/members/" + partner.Id.String() + "/diary-entries"

	var e httpapi.DiaryEntry
	c.Post(momPath, entry("not yet", httpapi.VisibilityPrivate), http.StatusCreated, &e)
	if contains(diaryBodies(c, partner), "not yet") {
		t.Fatal("a new private entry must stay hidden from the partner")
	}

	// The partner cannot widen or even find someone else's entry.
	c.Patch(partnerPath+"/"+e.Id.String(), httpapi.DiaryEntryUpdate{Visibility: httpapi.VisibilityPartner}, http.StatusNotFound, nil)
	c.Patch(momPath+"/"+strangerEntry.Id.String(), httpapi.DiaryEntryUpdate{Visibility: httpapi.VisibilityPrivate}, http.StatusNotFound, nil)
	c.Patch(momPath+"/"+uuid.NewString(), httpapi.DiaryEntryUpdate{Visibility: httpapi.VisibilityPrivate}, http.StatusNotFound, nil)
	if contains(diaryBodies(c, partner), "not yet") {
		t.Fatal("a failed share must not reveal the entry")
	}

	var shared httpapi.DiaryEntry
	c.Patch(momPath+"/"+e.Id.String(), httpapi.DiaryEntryUpdate{Visibility: httpapi.VisibilityPartner}, http.StatusOK, &shared)
	if shared.Visibility != httpapi.VisibilityPartner || !contains(diaryBodies(c, partner), "not yet") {
		t.Fatal("after the author shares it, the partner must see the entry")
	}
	c.Patch(momPath+"/"+e.Id.String(), httpapi.DiaryEntryUpdate{Visibility: httpapi.VisibilityPrivate}, http.StatusOK, nil)
	if contains(diaryBodies(c, partner), "not yet") {
		t.Fatal("after the author unshares it, the partner must not see the entry")
	}
}

func TestDiaryIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/diary-entries"

	var e httpapi.DiaryEntry
	c.Post(path, entry("audited", httpapi.VisibilityPrivate), http.StatusCreated, &e)
	c.Get(path, http.StatusOK, nil)
	c.Patch(path+"/"+e.Id.String(), httpapi.DiaryEntryUpdate{Visibility: httpapi.VisibilityPartner}, http.StatusOK, nil)
	for action, want := range map[string]int{"create": 1, "read": 1, "update": 1} {
		if n := c.AuditCount(fam.Id, action, "diary_entry"); n != want {
			t.Errorf("%s audit rows = %d, want %d", action, n, want)
		}
	}
}
