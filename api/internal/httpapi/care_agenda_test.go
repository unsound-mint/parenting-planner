package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func agendaPath(m httpapi.Parent) string { return careBase(m) + "/psychologist-agenda" }

// lowCheckins gives a parent three rough days, which makes three agenda topics.
func lowCheckins(c *testutil.Client, m httpapi.Parent) {
	for i := 0; i < 3; i++ {
		c.Post("/api/members/"+m.Id.String()+"/mood-checkins", map[string]any{"mood": 1, "energy": 1, "sleepHours": 4, "visibility": "private"}, http.StatusCreated, nil)
	}
}

func topicIDs(a httpapi.PsychologistAgenda) []uuid.UUID {
	out := []uuid.UUID{}
	for _, t := range a.Topics {
		out = append(out, t.Id)
	}
	return out
}

func sameIDs(a, b []uuid.UUID) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestAgendaOrderAndRemovalSurviveAReload(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	lowCheckins(c, mom)
	var start httpapi.PsychologistAgenda
	c.Get(agendaPath(mom), http.StatusOK, &start)
	ids := topicIDs(start)
	if len(ids) < 3 {
		t.Fatalf("setup: want at least 3 topics, got %d", len(ids))
	}

	// Reverse the order and drop the first topic.
	want := []uuid.UUID{ids[2], ids[1]}
	var saved httpapi.PsychologistAgenda
	c.Put(agendaPath(mom), map[string]any{"topicIds": want}, http.StatusOK, &saved)
	if !sameIDs(topicIDs(saved), want) {
		t.Errorf("the response is the agenda after the change: %v, want %v", topicIDs(saved), want)
	}
	var reloaded httpapi.PsychologistAgenda
	c.Get(agendaPath(mom), http.StatusOK, &reloaded)
	if !sameIDs(topicIDs(reloaded), want) {
		t.Errorf("after a reload: %v, want %v", topicIDs(reloaded), want)
	}
	// A removed topic stays removed, so it is not a known topic any more.
	c.Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{ids[0]}}, http.StatusBadRequest, nil)
	// An empty list clears the agenda.
	var empty httpapi.PsychologistAgenda
	c.Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{}}, http.StatusOK, &empty)
	c.Get(agendaPath(mom), http.StatusOK, &reloaded)
	if len(empty.Topics) != 0 || len(reloaded.Topics) != 0 {
		t.Errorf("an empty list clears the agenda: %+v %+v", empty.Topics, reloaded.Topics)
	}
}

func TestNewTopicsFollowTheSavedOrder(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	lowCheckins(c, mom)
	var a httpapi.PsychologistAgenda
	c.Get(agendaPath(mom), http.StatusOK, &a)
	ids := topicIDs(a)
	c.Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{ids[1]}}, http.StatusOK, nil) // saved order: one topic, the others removed
	var after httpapi.PsychologistAgenda
	c.Get(agendaPath(mom), http.StatusOK, &after)
	if !sameIDs(topicIDs(after), []uuid.UUID{ids[1]}) {
		t.Errorf("only the kept topic: %v", topicIDs(after))
	}
}

func TestAgendaUpdateValidationAndPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	lowCheckins(c, mom)
	lowCheckins(c, jake)
	var m, j httpapi.PsychologistAgenda
	c.Get(agendaPath(mom), http.StatusOK, &m)
	c.Get(agendaPath(jake), http.StatusOK, &j)
	momIDs, jakeIDs := topicIDs(m), topicIDs(j)

	c.Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{uuid.New()}}, http.StatusBadRequest, nil)           // made up
	c.Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{momIDs[0], momIDs[0]}}, http.StatusBadRequest, nil) // twice
	c.Put(agendaPath(mom), map[string]any{"topicIds": []string{"not-a-uuid"}}, http.StatusBadRequest, nil)
	c.Put(agendaPath(mom), map[string]any{}, http.StatusBadRequest, nil)
	// The other parent's topic ids are as unknown as a made-up one, and change nothing.
	c.Put(agendaPath(mom), map[string]any{"topicIds": jakeIDs}, http.StatusBadRequest, nil)
	var jAfter, mAfter httpapi.PsychologistAgenda
	c.Get(agendaPath(jake), http.StatusOK, &jAfter)
	c.Get(agendaPath(mom), http.StatusOK, &mAfter)
	if !sameIDs(topicIDs(jAfter), jakeIDs) || !sameIDs(topicIDs(mAfter), momIDs) {
		t.Errorf("a refused update must change nothing")
	}
	// Mom arranging hers does not touch Jake's.
	c.Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{momIDs[1]}}, http.StatusOK, nil)
	c.Get(agendaPath(jake), http.StatusOK, &jAfter)
	if !sameIDs(topicIDs(jAfter), jakeIDs) {
		t.Errorf("the partner's agenda must be unchanged: %v, want %v", topicIDs(jAfter), jakeIDs)
	}
	if n := c.AuditCount(fam.Id, "update", "psychologist_agenda"); n != 1 {
		t.Errorf("update audit rows = %d, want 1", n)
	}
	for _, cg := range fam.Caregivers {
		c.Put("/api/members/"+cg.Id.String()+"/psychologist-agenda", map[string]any{"topicIds": []uuid.UUID{}}, http.StatusNotFound, nil)
	}
	testutil.New(t).Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{}}, http.StatusUnauthorized, nil)
	second := c.StartDemo("pregnancy") // another family's session now
	c.Put(agendaPath(mom), map[string]any{"topicIds": []uuid.UUID{}}, http.StatusNotFound, nil)
	_ = second
}
