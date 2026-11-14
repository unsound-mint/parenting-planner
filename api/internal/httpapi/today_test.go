package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func todayPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/today" }

func TestTodayNeedsASessionAndAKnownPerson(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	testutil.New(t).Get(todayPath(mom.Id), http.StatusUnauthorized, nil)
	c.Get(todayPath(uuid.New()), http.StatusNotFound, nil)
}

func TestTodayDiffersPerParent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var m, j httpapi.Today
	c.Get(todayPath(mom.Id), http.StatusOK, &m)
	c.Get(todayPath(jake.Id), http.StatusOK, &j)
	if m.Role != httpapi.PersonRoleMother || m.Stage != httpapi.StagePregnancy || m.Date.Format("2006-01-02") != "2026-11-14" {
		t.Errorf("mom today = %+v", m)
	}
	ids := func(td httpapi.Today) []string {
		out := []string{}
		for _, it := range td.PlanItems {
			out = append(out, it.RuleId)
			if it.Status != httpapi.PlanItemStatusDue && it.Status != httpapi.PlanItemStatusOverdue {
				t.Errorf("only due or overdue items, got %s", it.Status)
			}
		}
		return out
	}
	// Mom has the glucose screen due; Jake's Tdap is only upcoming, so it is not on his Today yet.
	if got := ids(m); len(got) == 0 || len(got) > 3 || got[0] != "glucose-screen" {
		t.Errorf("mom's plan items = %v, want the glucose screen first", got)
	}
	for _, id := range ids(j) {
		if id == "glucose-screen" {
			t.Error("Jake must not get mom's plan items")
		}
	}
	if len(m.Guides) == 0 || len(m.Guides) > 2 {
		t.Errorf("want up to 2 guides, got %d", len(m.Guides))
	}
	for _, g := range m.Guides {
		if g.Locked {
			t.Errorf("a locked guide must not be offered: %s", g.Id)
		}
	}
	if m.CareSummary != nil || len(m.PendingHandoffs) != 0 || len(m.Tasks) != 0 {
		t.Errorf("before the baby is home there is no care section: %+v", m)
	}
}

func TestTodayEventsFollowVisibility(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleNanny {
			nanny = cg
		}
	}
	c.Post(calBase(mom), event("OB visit", "family", time.Hour, nanny.Id), http.StatusCreated, nil)
	c.Post(calBase(mom), event("Therapy", "private", 2*time.Hour), http.StatusCreated, nil)
	cls := event("Baby class", "family", 3*time.Hour, nanny.Id)
	cls["kind"] = "class"
	c.Post(calBase(mom), cls, http.StatusCreated, nil)
	c.Post(calBase(mom), event("Next week", "family", 5*24*time.Hour), http.StatusCreated, nil)

	titles := func(id uuid.UUID) []string {
		var td httpapi.Today
		c.Get(todayPath(id), http.StatusOK, &td)
		out := []string{}
		for _, e := range td.Events {
			out = append(out, e.Title)
		}
		return out
	}
	if got := titles(mom.Id); len(got) != 3 { // OB visit, Therapy, Baby class: today and tomorrow only
		t.Errorf("mom sees %v", got)
	}
	if got := titles(jake.Id); len(got) != 2 || got[0] == "Therapy" || got[1] == "Therapy" {
		t.Errorf("jake must not see mom's private event: %v", got)
	}
	if got := titles(nanny.Id); len(got) != 1 || got[0] != "Baby class" {
		t.Errorf("the nanny sees only what she attends and never an appointment: %v", got)
	}
}

func TestTodayForCaregiversIsLimited(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	c.Post(careLog(p.mom.Id), map[string]any{"kind": "feed", "startedAt": ago(30 * time.Minute), "feedMethod": "bottle_formula", "amountMl": 90}, http.StatusCreated, nil)
	c.Post(shiftsPath(p.nanny.Id), shiftBody("Saturday evening", "18:00", "22:00", "sat"), http.StatusCreated, nil)
	var h httpapi.Handoff
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.nanny.Id, "note": "Fed 14:30"}, http.StatusCreated, &h)

	var td httpapi.Today
	c.Get(todayPath(p.nanny.Id), http.StatusOK, &td)
	if td.Role != httpapi.PersonRoleNanny || len(td.PlanItems) != 0 || len(td.Guides) != 0 || len(td.Tasks) != 0 {
		t.Errorf("a nanny gets no plan, guides or tasks: %+v", td)
	}
	if td.CareSummary == nil || td.CareSummary.LastFeed == nil || *td.CareSummary.LastFeed.AmountMl != 90 {
		t.Errorf("care summary = %+v", td.CareSummary)
	}
	if len(td.PendingHandoffs) != 1 || td.PendingHandoffs[0].Id != h.Id {
		t.Errorf("pending handoffs = %+v", td.PendingHandoffs)
	}
	if td.NextShift == nil || td.NextShift.Kind != httpapi.CalendarEventKindShift || td.NextShift.Title != "Saturday evening" {
		t.Errorf("next shift = %+v", td.NextShift)
	}
	// Mom has no handoff waiting; the handoff is the nanny's.
	var mt httpapi.Today
	c.Get(todayPath(p.mom.Id), http.StatusOK, &mt)
	if len(mt.PendingHandoffs) != 0 || mt.NextShift != nil || mt.CareSummary == nil {
		t.Errorf("mom today = %+v", mt)
	}
	// Reading Today is the person's own business and does not fill the access log.
	before := c.AuditCount(p.fam.Id, "read", "handoff") + c.AuditCount(p.fam.Id, "read", "care_log_entry")
	c.Get(todayPath(p.nanny.Id), http.StatusOK, nil)
	if after := c.AuditCount(p.fam.Id, "read", "handoff") + c.AuditCount(p.fam.Id, "read", "care_log_entry"); after != before {
		t.Errorf("Today must not write access log rows: %d -> %d", before, after)
	}

	// Without the permissions the sections are empty, not an error.
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{}' WHERE id = $1`, p.nanny.Id); err != nil {
		t.Fatal(err)
	}
	var bare httpapi.Today
	c.Get(todayPath(p.nanny.Id), http.StatusOK, &bare)
	if bare.CareSummary != nil || len(bare.PendingHandoffs) != 0 || bare.NextShift != nil || len(bare.Events) != 0 {
		t.Errorf("a nanny without permissions sees nothing: %+v", bare)
	}
}

func TestTodayPregnancyGuidesForAGrandparentNeedThePermission(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	var grandma httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleGrandparent {
			grandma = cg
		}
	}
	var td httpapi.Today
	c.Get(todayPath(grandma.Id), http.StatusOK, &td)
	if len(td.PlanItems) != 0 {
		t.Errorf("a grandparent never gets plan items: %+v", td.PlanItems)
	}
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{care_log}' WHERE id = $1`, grandma.Id); err != nil {
		t.Fatal(err)
	}
	var limited httpapi.Today
	c.Get(todayPath(grandma.Id), http.StatusOK, &limited)
	if len(limited.Guides) != 0 {
		t.Errorf("without pregnancy_updates a grandparent gets no pregnancy guides: %+v", limited.Guides)
	}
}
