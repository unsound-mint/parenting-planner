package httpapi_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func caregiver(t *testing.T, fam httpapi.Family, role httpapi.CaregiverRole) httpapi.Caregiver {
	t.Helper()
	for _, c := range fam.Caregivers {
		if c.Role == role {
			return c
		}
	}
	t.Fatalf("demo family has no %s", role)
	return httpapi.Caregiver{}
}

func postcardPath(id uuid.UUID, tail string) string {
	return "/api/members/" + id.String() + "/postcard" + tail
}

func TestPostcardWeekAndLoveFlow(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy") // week 25
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	gran := caregiver(t, fam, httpapi.CaregiverRoleGrandparent)

	var pc httpapi.Postcard
	c.Get(postcardPath(gran.Id, ""), http.StatusOK, &pc)
	if pc.Kind != httpapi.PostcardKindPregnancy || pc.Period != "Week 25" || !strings.HasPrefix(pc.Headline, "About the size of ") || pc.Comparison == nil || pc.Source.Url == "" {
		t.Fatalf("pregnancy postcard: %+v", pc)
	}
	if pc.Line != nil || pc.LoveSentToday || len(pc.Loves) != 0 {
		t.Errorf("fresh postcard has a line or loves: %+v", pc)
	}

	// A parent writes the line; the grandparent sees it, and the other parent can replace it.
	c.Put(postcardPath(mom.Id, "/line"), map[string]any{"text": "  Kicks kept me up, happily  "}, http.StatusOK, &pc)
	if pc.Line == nil || pc.Line.Text != "Kicks kept me up, happily" || pc.Line.AuthorName != mom.DisplayName {
		t.Fatalf("line after save: %+v", pc.Line)
	}
	c.Put(postcardPath(dad.Id, "/line"), map[string]any{"text": "Week 25 and counting"}, http.StatusOK, nil)
	c.Get(postcardPath(gran.Id, ""), http.StatusOK, &pc)
	if pc.Line == nil || pc.Line.Text != "Week 25 and counting" || pc.Line.AuthorName != dad.DisplayName {
		t.Errorf("grandparent sees %+v", pc.Line)
	}

	// Send love twice: both parents get one notification, the message stays out of its title.
	c.Post(postcardPath(gran.Id, "/love"), map[string]any{"message": "So proud of you both"}, http.StatusOK, &pc)
	if !pc.LoveSentToday || len(pc.Loves) != 1 || pc.Loves[0].Message == nil || *pc.Loves[0].Message != "So proud of you both" {
		t.Fatalf("after love: %+v", pc)
	}
	c.Post(postcardPath(gran.Id, "/love"), map[string]any{}, http.StatusOK, &pc)
	if len(pc.Loves) != 2 {
		t.Errorf("both hearts are kept, got %d", len(pc.Loves))
	}
	for _, p := range []httpapi.Parent{mom, dad} {
		got := ofKind(bell(c, p), httpapi.NotificationKindLoveSent)
		if len(got) != 1 || got[0].Title != gran.DisplayName+" sent love" || got[0].ActorId == nil || *got[0].ActorId != gran.Id {
			t.Errorf("%s bell: %+v", p.DisplayName, got)
		}
	}

	// Parents see the hearts received; their own card has no "sent today".
	c.Get(postcardPath(mom.Id, ""), http.StatusOK, &pc)
	if len(pc.Loves) != 2 || pc.Loves[0].FromName != gran.DisplayName || pc.LoveSentToday {
		t.Errorf("parent view: %+v", pc)
	}
}

func TestPostcardAccessFollowsPermissions(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	gran, nanny := caregiver(t, fam, httpapi.CaregiverRoleGrandparent), caregiver(t, fam, httpapi.CaregiverRoleNanny)

	// A nanny never has a postcard, even with every permission.
	c.Get(postcardPath(nanny.Id, ""), http.StatusForbidden, nil)
	c.Post(postcardPath(nanny.Id, "/love"), map[string]any{}, http.StatusForbidden, nil)
	c.Put(postcardPath(nanny.Id, "/line"), map[string]any{"text": "hi"}, http.StatusForbidden, nil)
	// Parents cannot send love; a grandparent cannot write the line.
	c.Post(postcardPath(mom.Id, "/love"), map[string]any{}, http.StatusForbidden, nil)
	c.Put(postcardPath(gran.Id, "/line"), map[string]any{"text": "hi"}, http.StatusForbidden, nil)

	// Without pregnancy_updates a grandparent gets no pregnancy postcard and cannot send love.
	if _, err := c.Pool.Exec(context.Background(), `UPDATE members SET permissions = ARRAY['care_log','baby_passport','schedule'] WHERE id = $1`, gran.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(postcardPath(gran.Id, ""), http.StatusForbidden, nil)
	c.Post(postcardPath(gran.Id, "/love"), map[string]any{}, http.StatusForbidden, nil)
}

func TestPostcardAfterBirthNeedsBabyPassport(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	gran := caregiver(t, fam, httpapi.CaregiverRoleGrandparent)

	var pc httpapi.Postcard
	c.Get(postcardPath(gran.Id, ""), http.StatusOK, &pc)
	if pc.Kind != httpapi.PostcardKindBaby || pc.Comparison != nil || !strings.HasPrefix(pc.Period, "Week ") || pc.Source.Url == "" {
		t.Fatalf("baby postcard: %+v", pc)
	}
	if _, err := c.Pool.Exec(context.Background(), `UPDATE members SET permissions = ARRAY['care_log'] WHERE id = $1`, gran.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(postcardPath(gran.Id, ""), http.StatusForbidden, nil)
}

func TestPostcardPlanningHasNone(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("planning")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Get(postcardPath(mom.Id, ""), http.StatusConflict, nil)
	c.Put(postcardPath(mom.Id, "/line"), map[string]any{"text": "hi"}, http.StatusConflict, nil)
}

func TestPostcardValidationAndClearingTheLine(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	gran := caregiver(t, fam, httpapi.CaregiverRoleGrandparent)

	c.Put(postcardPath(mom.Id, "/line"), map[string]any{"text": strings.Repeat("a", 141)}, http.StatusBadRequest, nil)
	c.Put(postcardPath(mom.Id, "/line"), map[string]any{}, http.StatusBadRequest, nil)
	c.Post(postcardPath(gran.Id, "/love"), map[string]any{"message": strings.Repeat("a", 141)}, http.StatusBadRequest, nil)
	c.Get(postcardPath(uuid.New(), ""), http.StatusNotFound, nil)

	var pc httpapi.Postcard
	c.Put(postcardPath(mom.Id, "/line"), map[string]any{"text": "Hello"}, http.StatusOK, &pc)
	var cleared httpapi.Postcard
	c.Put(postcardPath(mom.Id, "/line"), map[string]any{"text": "   "}, http.StatusOK, &cleared)
	if cleared.Line != nil {
		t.Errorf("a blank text should clear the line, got %+v", cleared.Line)
	}
}

// The postcard reads no private record: a diary entry and a mood note with
// distinctive text never reach any postcard view.
func TestPostcardNeverCarriesPrivateText(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	gran := caregiver(t, fam, httpapi.CaregiverRoleGrandparent)
	const secret = "zebra-secret-note"
	c.Post("/api/members/"+mom.Id.String()+"/mood-checkins", map[string]any{"mood": 2, "energy": 2, "sleepHours": 5, "note": secret, "visibility": "private"}, http.StatusCreated, nil)
	for _, id := range []uuid.UUID{gran.Id, mom.Id} {
		status, body := c.Raw(http.MethodGet, postcardPath(id, ""), "", nil)
		if status != http.StatusOK || strings.Contains(string(body), secret) {
			t.Errorf("postcard for %s: status %d, leaks=%v", id, status, strings.Contains(string(body), secret))
		}
	}
}
