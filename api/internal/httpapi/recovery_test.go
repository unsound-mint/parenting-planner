package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func recoveryPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/recovery-checkins" }

func recoveryBody(vis string, bleeding string, signs ...string) map[string]any {
	if signs == nil {
		signs = []string{}
	}
	return map[string]any{
		"visibility": vis, "bleeding": bleeding, "pain": 3, "wound": "healing_well", "breasts": "comfortable",
		"pelvicFloor": "fine", "sleepHours": 5.5, "warningSigns": signs,
	}
}

func TestRecoveryCheckinValidation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Post(recoveryPath(mom.Id), map[string]any{"visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(recoveryPath(mom.Id), recoveryBody("family", "none"), http.StatusBadRequest, nil) // never wider than the partner
	c.Post(recoveryPath(mom.Id), recoveryBody("private", "gushing"), http.StatusBadRequest, nil)
	c.Post(recoveryPath(mom.Id), recoveryBody("private", "none", "toothache"), http.StatusBadRequest, nil)
	bad := recoveryBody("private", "none")
	bad["pain"] = 11
	c.Post(recoveryPath(mom.Id), bad, http.StatusBadRequest, nil)
	testutil.New(t).Post(recoveryPath(mom.Id), recoveryBody("private", "none"), http.StatusUnauthorized, nil)
}

func TestRecoveryNeedsABabyAndTheMother(t *testing.T) {
	c := testutil.New(t)
	preg := c.StartDemo("pregnancy")
	c.Post(recoveryPath(testutil.Parent(t, preg, httpapi.ParentRoleMother).Id), recoveryBody("private", "none"), http.StatusConflict, nil)
	c.Get("/api/members/"+testutil.Parent(t, preg, httpapi.ParentRoleMother).Id.String()+"/recovery-guidance", http.StatusConflict, nil)

	fam := c.StartDemo("newborn")
	jake := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	c.Post(recoveryPath(jake.Id), recoveryBody("private", "none"), http.StatusForbidden, nil)
}

func TestRecoveryIsPrivateUnlessSharedAndCaregiversNeverSeeIt(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	var mine httpapi.RecoveryCheckin
	c.Post(recoveryPath(p.mom.Id), recoveryBody("private", "light"), http.StatusCreated, &mine)
	var shared httpapi.RecoveryCheckin
	c.Post(recoveryPath(p.mom.Id), recoveryBody("partner", "none"), http.StatusCreated, &shared)

	ids := func(id uuid.UUID) map[uuid.UUID]bool {
		var l httpapi.RecoveryCheckinList
		c.Get(recoveryPath(id), http.StatusOK, &l)
		out := map[uuid.UUID]bool{}
		for _, e := range l.Items {
			out[e.Id] = true
		}
		return out
	}
	moms, partners := ids(p.mom.Id), ids(p.partner.Id)
	if !moms[mine.Id] || !moms[shared.Id] {
		t.Error("the mother sees all her check-ins")
	}
	if partners[mine.Id] || !partners[shared.Id] {
		t.Errorf("the partner sees only the shared one: %v", partners)
	}
	// Seeded: 5 check-ins, one shared, plus the two above.
	if len(moms) != 7 || len(partners) != 2 {
		t.Errorf("mother %d, partner %d", len(moms), len(partners))
	}
	// Only the author changes who can read.
	c.Patch(recoveryPath(p.partner.Id)+"/"+shared.Id.String(), map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
	c.Patch(recoveryPath(p.mom.Id)+"/"+shared.Id.String(), map[string]any{"visibility": "private"}, http.StatusOK, nil)
	if ids(p.partner.Id)[shared.Id] {
		t.Error("an unshared check-in must disappear for the partner")
	}
	// Caregivers never read or write.
	for _, cg := range []httpapi.Caregiver{p.grandma, p.nanny} {
		c.Get(recoveryPath(cg.Id), http.StatusNotFound, nil)
		c.Post(recoveryPath(cg.Id), recoveryBody("private", "none"), http.StatusNotFound, nil)
		c.Get("/api/members/"+cg.Id.String()+"/recovery-guidance", http.StatusNotFound, nil)
	}
	if n := c.AuditCount(p.fam.Id, "create", "recovery_checkin"); n != 2 {
		t.Errorf("creates audited: %d", n)
	}
}

func TestRecoveryUrgentSignsPointToUrgentHelp(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	var calm, heavy, fever httpapi.RecoveryCheckin
	c.Post(recoveryPath(p.mom.Id), recoveryBody("private", "light"), http.StatusCreated, &calm)
	c.Post(recoveryPath(p.mom.Id), recoveryBody("private", "heavy"), http.StatusCreated, &heavy)
	c.Post(recoveryPath(p.mom.Id), recoveryBody("private", "none", "fever"), http.StatusCreated, &fever)
	if calm.Urgent || !heavy.Urgent || !fever.Urgent {
		t.Errorf("urgent: calm %v heavy %v fever %v", calm.Urgent, heavy.Urgent, fever.Urgent)
	}
}

func TestRecoveryGuidanceIsSourcedAndFollowsTheBabysAge(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t) // Leo is 7 weeks old
	var g httpapi.RecoveryGuidance
	c.Get("/api/members/"+p.mom.Id.String()+"/recovery-guidance", http.StatusOK, &g)
	if g.Phase != httpapi.CheckupWindow || g.DaysSinceBirth != 49 || g.PostnatalCheck.Status != httpapi.RecoveryGuidancePostnatalCheckStatus("open") {
		t.Errorf("guidance = %+v", g)
	}
	if len(g.Points) == 0 || len(g.Sources) == 0 {
		t.Fatal("guidance needs points and sources")
	}
	for _, s := range g.Sources {
		if s.Url == "" || s.CheckedAt.IsZero() {
			t.Errorf("source without url or checked date: %+v", s)
		}
	}
}

func TestMemberPreferencesArePerParent(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	path := func(id uuid.UUID) string { return "/api/members/" + id.String() + "/preferences" }
	var prefs httpapi.MemberPreferences
	c.Get(path(p.mom.Id), http.StatusOK, &prefs)
	if prefs.EssentialsOnly {
		t.Error("essentials only starts off")
	}
	c.Put(path(p.mom.Id), map[string]any{"essentialsOnly": true}, http.StatusOK, &prefs)
	if !prefs.EssentialsOnly {
		t.Error("the update returns the new value")
	}
	c.Get(path(p.mom.Id), http.StatusOK, &prefs)
	if !prefs.EssentialsOnly {
		t.Error("the setting is stored")
	}
	c.Get(path(p.partner.Id), http.StatusOK, &prefs)
	if prefs.EssentialsOnly {
		t.Error("the partner's setting is their own")
	}
	c.Put(path(p.mom.Id), map[string]any{}, http.StatusBadRequest, nil)
	c.Get(path(p.grandma.Id), http.StatusNotFound, nil)
}
