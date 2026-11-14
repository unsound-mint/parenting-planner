package httpapi_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func lowCheckin(vis httpapi.Visibility) httpapi.MoodCheckinInput {
	return httpapi.MoodCheckinInput{Mood: 2, Energy: 2, SleepHours: 5, Visibility: vis}
}

func patternsOf(c *testutil.Client, member uuid.UUID) httpapi.MoodPatternList {
	var out httpapi.MoodPatternList
	c.Get("/api/members/"+member.String()+"/mood-patterns", http.StatusOK, &out)
	return out
}

// Demo step 4: the seed has two low days, and today's low check-in completes
// the pattern; the plan gains the talk-to-someone item at the same time.
func TestThirdLowDayCompletesThePattern(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	base := "/api/members/" + mom.Id.String()

	hasPlanItem := func() bool {
		var pl httpapi.Plan
		c.Get(base+"/plan", http.StatusOK, &pl)
		return slices.ContainsFunc(pl.Items, func(it httpapi.PlanItem) bool { return it.RuleId == "low-mood-mother" })
	}
	if got := patternsOf(c, mom.Id); len(got.Items) != 0 {
		t.Fatalf("two seeded low days must not be a pattern yet, got %+v", got.Items)
	}
	if hasPlanItem() {
		t.Fatal("low-mood item must not be in the plan before the pattern")
	}

	var created httpapi.MoodCheckin
	c.Post(base+"/mood-checkins", lowCheckin(httpapi.VisibilityPrivate), http.StatusCreated, &created)

	got := patternsOf(c, mom.Id).Items
	if len(got) != 1 {
		t.Fatalf("got %d patterns, want 1", len(got))
	}
	p := got[0]
	if p.Kind != httpapi.LowMoodAndSleep || p.Days != 3 || len(p.CheckinIds) != 3 {
		t.Errorf("want low_mood_and_sleep over 3 days and 3 check-ins, got %+v", p)
	}
	if p.CheckinIds[len(p.CheckinIds)-1] != created.Id {
		t.Errorf("newest check-in must be last, got %v want %s last", p.CheckinIds, created.Id)
	}
	if p.ProviderType != httpapi.ProviderTypePerinatalTherapist || p.Source.Url == "" {
		t.Errorf("want a perinatal therapist and a source, got %+v", p)
	}
	if strings.Contains(strings.ToLower(p.Message), "depress") {
		t.Errorf("message must not be diagnostic: %s", p.Message)
	}
	if !hasPlanItem() {
		t.Error("the plan must include the low-mood item once the pattern completes")
	}
}

// A pattern uses only the acting parent's own check-ins: the partner's
// patterns ignore the mother's check-ins even when she shared them, and the
// partner's shared check-ins never enter hers.
func TestMoodPatternPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var shared httpapi.MoodCheckin
	c.Post("/api/members/"+mom.Id.String()+"/mood-checkins", lowCheckin(httpapi.VisibilityPartner), http.StatusCreated, &shared)
	var partnersOwn httpapi.MoodCheckin
	c.Post("/api/members/"+partner.Id.String()+"/mood-checkins", lowCheckin(httpapi.VisibilityFamily), http.StatusCreated, &partnersOwn)

	var visible httpapi.MoodCheckinList
	c.Get("/api/members/"+partner.Id.String()+"/mood-checkins", http.StatusOK, &visible)
	if !slices.ContainsFunc(visible.Items, func(m httpapi.MoodCheckin) bool { return m.Id == shared.Id }) {
		t.Fatal("setup: the partner should be able to read the shared check-in")
	}

	if got := patternsOf(c, partner.Id); len(got.Items) != 0 {
		t.Errorf("partner's patterns must not use the mother's check-ins, got %+v", got.Items)
	}
	mine := patternsOf(c, mom.Id).Items
	if len(mine) != 1 {
		t.Fatalf("mother should have her own pattern, got %d", len(mine))
	}
	if slices.Contains(mine[0].CheckinIds, partnersOwn.Id) {
		t.Error("mother's pattern must not include the partner's check-in")
	}
	if !slices.Contains(mine[0].CheckinIds, shared.Id) {
		t.Error("mother's pattern must include her own check-in")
	}
}

func TestMoodPatternsAreAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	patternsOf(c, mom.Id)
	patternsOf(c, mom.Id)
	if n := c.AuditCount(fam.Id, "read", "mood_pattern"); n != 2 {
		t.Errorf("read audit rows = %d, want 2", n)
	}
}

func TestMoodPatternsNeedSessionAndMember(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/members/"+uuid.NewString()+"/mood-patterns", http.StatusUnauthorized, nil)
	c.StartDemo("pregnancy")
	c.Get("/api/members/"+uuid.NewString()+"/mood-patterns", http.StatusNotFound, nil)
}
