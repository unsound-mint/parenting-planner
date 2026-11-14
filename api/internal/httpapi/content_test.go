package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func guideIDs(l httpapi.GuideList) map[string]httpapi.Guide {
	m := map[string]httpapi.Guide{}
	for _, g := range l.Items {
		m[g.Id] = g
	}
	return m
}

func TestGuidesFollowTheFamilyStage(t *testing.T) {
	cases := []struct {
		template  string
		want, not string
	}{
		{"planning", "planning-folic-acid", "toddler-sleep"},
		{"pregnancy", "preg-glucose-screen", "planning-folic-acid"},
		{"newborn", "postpartum-night-shifts", "preg-tdap"},
		{"preschool", "preschool-vision", "postpartum-night-shifts"},
	}
	for _, tc := range cases {
		c := testutil.New(t)
		mom := testutil.Parent(t, c.StartDemo(tc.template), httpapi.ParentRoleMother)
		var l httpapi.GuideList
		c.Get("/api/members/"+mom.Id.String()+"/guides", http.StatusOK, &l)
		got := guideIDs(l)
		if _, ok := got[tc.want]; !ok {
			t.Errorf("%s family misses %s, got %d guides", tc.template, tc.want, len(l.Items))
		}
		if _, ok := got[tc.not]; ok {
			t.Errorf("%s family got %s", tc.template, tc.not)
		}
		for _, g := range l.Items {
			if g.Source.Url == "" {
				t.Errorf("%s has no source", g.Id)
			}
		}
	}
}

func TestGuidesFollowTheRole(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var ml, pl httpapi.GuideList
	c.Get("/api/members/"+mom.Id.String()+"/guides", http.StatusOK, &ml)
	c.Get("/api/members/"+partner.Id.String()+"/guides", http.StatusOK, &pl)
	if _, ok := guideIDs(ml)["preg-glucose-screen"]; !ok {
		t.Error("mother misses the glucose guide")
	}
	if _, ok := guideIDs(pl)["preg-glucose-screen"]; ok {
		t.Error("partner sees a mother-only guide")
	}
	if _, ok := guideIDs(pl)["preg-partner-vaccines"]; !ok {
		t.Error("partner misses the partner vaccines guide")
	}
}

func TestBirthPrepLocksUntilWeek32(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy") // week 25
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	base := "/api/members/" + mom.Id.String()

	var l httpapi.GuideList
	c.Get(base+"/guides?kind=birth_prep", http.StatusOK, &l)
	if len(l.Items) != 0 {
		t.Errorf("week 25 already lists %d birth prep modules", len(l.Items))
	}

	// Week 30: listed, locked. Due date 2027-01-23 is week 30 on 2026-11-14.
	c.Patch(base+"/family", map[string]any{"dueDate": "2027-01-23"}, http.StatusOK, nil)
	c.Get(base+"/guides?kind=birth_prep", http.StatusOK, &l)
	if len(l.Items) == 0 {
		t.Fatal("no birth prep at week 30")
	}
	for _, g := range l.Items {
		if !g.Locked || g.UnlocksAtWeek == nil || *g.UnlocksAtWeek != 32 {
			t.Errorf("%s: locked=%v unlocksAtWeek=%v", g.Id, g.Locked, g.UnlocksAtWeek)
		}
	}

	// Week 33: open, and the weekly card carries the modules.
	c.Patch(base+"/family", map[string]any{"dueDate": "2027-01-02"}, http.StatusOK, nil)
	c.Get(base+"/guides?kind=birth_prep", http.StatusOK, &l)
	for _, g := range l.Items {
		if g.Locked {
			t.Errorf("%s is locked at week 33", g.Id)
		}
	}
	var w httpapi.PregnancyWeek
	c.Get(base+"/pregnancy-weeks/33", http.StatusOK, &w)
	if !w.IsCurrentWeek || len(w.BirthPrep) == 0 || w.BirthPrep[0].Locked {
		t.Errorf("week 33 card: current=%v birthPrep=%+v", w.IsCurrentWeek, w.BirthPrep)
	}
	// Looking ahead is allowed, but the modules stay locked for this family's week.
	c.Get(base+"/pregnancy-weeks/36", http.StatusOK, &w)
	if w.IsCurrentWeek {
		t.Error("week 36 is not the current week")
	}
}

func TestPregnancyWeekCard(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var mw, pw httpapi.PregnancyWeek
	c.Get("/api/members/"+mom.Id.String()+"/pregnancy-weeks/25", http.StatusOK, &mw)
	c.Get("/api/members/"+partner.Id.String()+"/pregnancy-weeks/25", http.StatusOK, &pw)
	if !mw.IsCurrentWeek || mw.Week != 25 || mw.Source.Url == "" || len(mw.Tasks) != 1 {
		t.Errorf("week 25 card: %+v", mw)
	}
	if mw.Tasks[0] == pw.Tasks[0] {
		t.Errorf("mother and partner share the task %q", mw.Tasks[0])
	}
	if mw.Size == nil || mw.Size.WeightG == nil || mw.Size.WeightRangeG == nil || len(mw.Size.Sources) < 2 || mw.Development == nil || *mw.Development == "" {
		t.Errorf("week 25 size: %+v", mw.Size)
	}
	var early httpapi.PregnancyWeek
	c.Get("/api/members/"+mom.Id.String()+"/pregnancy-weeks/8", http.StatusOK, &early)
	if early.Size == nil || early.Size.WeightG != nil || early.Size.WeightRangeG != nil || len(early.Size.Sources) == 0 {
		t.Errorf("week 8 size: %+v", early.Size)
	}
	for _, wk := range []string{"4", "40"} {
		c.Get("/api/members/"+mom.Id.String()+"/pregnancy-weeks/"+wk, http.StatusOK, nil)
	}
	c.Get("/api/members/"+mom.Id.String()+"/pregnancy-weeks/3", http.StatusBadRequest, nil)
	c.Get("/api/members/"+mom.Id.String()+"/pregnancy-weeks/41", http.StatusBadRequest, nil)
}

func TestPregnancyWeekNeedsPregnancy(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("newborn"), httpapi.ParentRoleMother)
	var e httpapi.Error
	c.Get("/api/members/"+mom.Id.String()+"/pregnancy-weeks/20", http.StatusConflict, &e)
	if e.Code != "not_pregnant" {
		t.Errorf("code = %q", e.Code)
	}
}

func TestContentRejectsOtherFamiliesAndNoSession(t *testing.T) {
	c := testutil.New(t)
	other := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c2 := testutil.New(t)
	c2.StartDemo("pregnancy")
	c2.Get("/api/members/"+other.Id.String()+"/guides", http.StatusNotFound, nil)
	c2.Get("/api/members/"+other.Id.String()+"/pregnancy-weeks/20", http.StatusNotFound, nil)
}

func TestGuidesCarryTheirRuleAndTheirAction(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var l httpapi.GuideList
	c.Get("/api/members/"+mom.Id.String()+"/guides", http.StatusOK, &l)
	guides := guideIDs(l)

	tdap := guides["preg-tdap"]
	if tdap.RuleId == nil || *tdap.RuleId != "tdap-pregnancy" {
		t.Errorf("preg-tdap explains the Tdap rule: %+v", tdap.RuleId)
	}
	if a := tdap.Action; a == nil || a.Kind != httpapi.GuideActionKindAskAtVisit || a.Question == nil || *a.Question == "" {
		t.Errorf("preg-tdap action = %+v", tdap.Action)
	}
	if g := guides["preg-warning-signs"]; g.RuleId != nil || g.Action == nil || g.Action.Kind != httpapi.GuideActionKindPractice {
		t.Errorf("a guide with no rule has no ruleId, and a practice action: %+v", g)
	}
	// Every article in this family's list has one action with its payload; birth prep has none.
	for _, g := range l.Items {
		if g.Kind == httpapi.BirthPrep {
			if g.Action != nil {
				t.Errorf("%s: birth prep has no action", g.Id)
			}
			continue
		}
		if g.Action == nil {
			t.Errorf("%s has no action", g.Id)
		}
	}
	// The night shift guide suggests a real shift.
	nf := testutil.New(t)
	newborn := testutil.Parent(t, nf.StartDemo("newborn"), httpapi.ParentRoleMother)
	var nl httpapi.GuideList
	nf.Get("/api/members/"+newborn.Id.String()+"/guides", http.StatusOK, &nl)
	if a := guideIDs(nl)["postpartum-newborn-visit"].Action; a == nil || a.Kind != httpapi.GuideActionKindAskAtVisit || a.Question == nil {
		t.Errorf("the newborn visit guide asks at the visit: %+v", a)
	}
	shift := guideIDs(nl)["postpartum-night-shifts"].Action
	if shift == nil || shift.Kind != httpapi.GuideActionKindCommitShift || shift.Shift == nil || len(shift.Shift.Days) != 7 || shift.Shift.StartTime != "22:00" || shift.Shift.EndTime != "02:00" || shift.Label == nil {
		t.Errorf("night shift action = %+v", shift)
	}
}

func TestStageNowForEveryDemoStage(t *testing.T) {
	cases := []struct {
		template, stage, period, sourceHost string
	}{
		{"newborn", "newborn", "Week 8 of life", "https://www.cdc.gov/act-early/milestones/2-months.html"},
		{"preschool", "preschool", "4 years", "https://www.cdc.gov/act-early/milestones/4-years.html"},
		{"planning", "planning", "Planning", "https://www.cdc.gov/pregnancy/about/index.html"},
	}
	for _, tc := range cases {
		c := testutil.New(t)
		fam := c.StartDemo(tc.template)
		// Both parents and the caregivers read the same reference line.
		mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
		var got httpapi.StageNow
		c.Get("/api/members/"+mom.Id.String()+"/now", http.StatusOK, &got)
		if string(got.Stage) != tc.stage || got.Period != tc.period {
			t.Errorf("%s: stage %s period %q", tc.template, got.Stage, got.Period)
		}
		if got.Headline == "" || got.Detail == "" || got.PlayIdea == "" || got.Note == "" {
			t.Errorf("%s: incomplete %+v", tc.template, got)
		}
		if len(got.Sources) == 0 || got.Sources[0].Url != tc.sourceHost || got.Sources[0].CheckedAt.String() != "2026-11-14" {
			t.Errorf("%s: sources %+v", tc.template, got.Sources)
		}
	}
}

func TestStageNowIsNotServedInPregnancy(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	var e httpapi.Error
	c.Get("/api/members/"+mom.Id.String()+"/now", http.StatusConflict, &e)
	if e.Code != "pregnant" {
		t.Errorf("code = %q", e.Code)
	}
}

func TestPregnancyGrowthServesEveryWeek(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var g httpapi.PregnancyGrowth
	c.Get("/api/members/"+mom.Id.String()+"/pregnancy-growth", http.StatusOK, &g)
	if g.CurrentWeek != 25 || len(g.Weeks) != 37 || g.Weeks[0].Week != 4 || g.Weeks[36].Week != 40 {
		t.Fatalf("currentWeek=%d, %d weeks", g.CurrentWeek, len(g.Weeks))
	}
	w25 := g.Weeks[21]
	if w25.Week != 25 || w25.Size.Comparison != "a zucchini" || w25.Size.WeightG == nil || len(w25.Hotspots) == 0 {
		t.Errorf("week 25: %+v", w25)
	}
	for _, h := range w25.Hotspots {
		if len(h.Sources) != 1 || h.Sources[0].Url == "" || h.Sources[0].CheckedAt.IsZero() {
			t.Errorf("week 25 hotspot without its source: %+v", h)
		}
	}
	c.Get("/api/members/"+partner.Id.String()+"/pregnancy-growth", http.StatusOK, nil)

	// The same gate as the weekly card: parents only, so a caregiver id is not found.
	for _, cg := range fam.Caregivers {
		c.Get("/api/members/"+cg.Id.String()+"/pregnancy-growth", http.StatusNotFound, nil)
		c.Get("/api/members/"+cg.Id.String()+"/pregnancy-weeks/25", http.StatusNotFound, nil)
	}
	other := testutil.New(t)
	other.StartDemo("pregnancy")
	other.Get("/api/members/"+mom.Id.String()+"/pregnancy-growth", http.StatusNotFound, nil)

	nf := testutil.New(t)
	newborn := testutil.Parent(t, nf.StartDemo("newborn"), httpapi.ParentRoleMother)
	var e httpapi.Error
	nf.Get("/api/members/"+newborn.Id.String()+"/pregnancy-growth", http.StatusConflict, &e)
	if e.Code != "not_pregnant" {
		t.Errorf("code = %q", e.Code)
	}
}
