package httpapi_test

import (
	"context"
	"net/http"
	"slices"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Every template in the contract must have a seed, or the start page offers a
// family that fails to open.
func TestEveryDemoTemplateStarts(t *testing.T) {
	c := testutil.New(t)
	for _, tpl := range []httpapi.DemoTemplate{
		httpapi.DemoTemplatePlanning, httpapi.DemoTemplatePregnancy, httpapi.DemoTemplateNewborn, httpapi.DemoTemplatePreschool,
	} {
		fam := c.StartDemo(string(tpl))
		if fam.Template != tpl {
			t.Errorf("%s: template = %s", tpl, fam.Template)
		}
		var again httpapi.Family
		c.Get("/api/family", http.StatusOK, &again)
		if again.Id != fam.Id {
			t.Errorf("%s: session does not point at the new family", tpl)
		}
		testutil.Parent(t, fam, httpapi.ParentRoleMother)
		testutil.Parent(t, fam, httpapi.ParentRolePartner)
	}
}

func TestDemoFamiliesHaveDifferentData(t *testing.T) {
	c := testutil.New(t)
	type want struct {
		stage    httpapi.Stage
		mother   string
		week     *int
		children map[string]int // name -> age in months
		// due: the family keeps a due date. Baby is home keeps it after the
		// birth, and the newborn demo looks like a family that lived through it.
		due bool
	}
	week := 25
	cases := map[httpapi.DemoTemplate]want{
		httpapi.DemoTemplatePlanning:  {stage: httpapi.StagePlanning, mother: "Maya", children: map[string]int{}},
		httpapi.DemoTemplatePregnancy: {stage: httpapi.StagePregnancy, mother: "Emily", week: &week, children: map[string]int{}, due: true},
		httpapi.DemoTemplateNewborn:   {stage: httpapi.StagePostpartum, mother: "Aisha", children: map[string]int{"Leo": 1}, due: true},
		httpapi.DemoTemplatePreschool: {stage: httpapi.StagePreschool, mother: "Rachel", children: map[string]int{"Ava": 49}},
	}
	seen := map[string]bool{}
	for tpl, w := range cases {
		fam := c.StartDemo(string(tpl))
		if fam.Stage != w.stage {
			t.Errorf("%s: stage = %s, want %s", tpl, fam.Stage, w.stage)
		}
		mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
		if mom.DisplayName != w.mother {
			t.Errorf("%s: mother = %s, want %s", tpl, mom.DisplayName, w.mother)
		}
		if seen[mom.DisplayName] {
			t.Errorf("%s: mother name %s reused across families", tpl, mom.DisplayName)
		}
		seen[mom.DisplayName] = true
		switch {
		case w.week == nil && fam.GestationalWeek != nil, w.due != (fam.DueDate != nil):
			t.Errorf("%s: unexpected pregnancy data %+v", tpl, fam.GestationalWeek)
		case w.week != nil && (fam.GestationalWeek == nil || *fam.GestationalWeek != *w.week):
			t.Errorf("%s: gestational week = %v, want %d", tpl, fam.GestationalWeek, *w.week)
		}
		got := map[string]int{}
		for _, ch := range fam.Children {
			got[ch.Name] = ch.AgeMonths
		}
		if len(got) != len(w.children) {
			t.Errorf("%s: children = %v, want %v", tpl, got, w.children)
		}
		for name, age := range w.children {
			if got[name] != age {
				t.Errorf("%s: %s is %d months, want %d", tpl, name, got[name], age)
			}
		}
	}
}

// The newborn family's partner logged three low days privately, so his plan
// suggests talking to someone and the mother's plan does not show his data.
func TestNewbornPartnerSeesHisOwnMoodItem(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	planIDs := func(p httpapi.Parent) []string {
		var pl httpapi.Plan
		c.Get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
		ids := []string{}
		for _, it := range pl.Items {
			ids = append(ids, it.RuleId)
		}
		return ids
	}
	if got := planIDs(testutil.Parent(t, fam, httpapi.ParentRolePartner)); !slices.Contains(got, "low-mood-partner") {
		t.Errorf("partner plan = %v, want low-mood-partner", got)
	}
	if got := planIDs(testutil.Parent(t, fam, httpapi.ParentRoleMother)); slices.Contains(got, "low-mood-mother") || slices.Contains(got, "low-mood-partner") {
		t.Errorf("mother plan = %v, want no low-mood item", got)
	}
}

// The same rules give each demo family and each parent a different plan,
// computed from the seeded data.
func TestDemoFamilyPlansFollowTheirData(t *testing.T) {
	c := testutil.New(t)
	cases := []struct {
		template        string
		mother, partner []string
	}{
		{"planning", []string{"folic-acid", "mmr-before-pregnancy"}, []string{"tetanus-booster"}},
		{"newborn", []string{"postpartum-visit", "infant-2-month-vaccines"}, []string{"low-mood-partner", "mood-screen-partner", "infant-2-month-vaccines"}},
		{"preschool", []string{"vision-screen", "preschool-boosters"}, []string{"vision-screen", "preschool-boosters"}},
	}
	for _, tc := range cases {
		fam := c.StartDemo(tc.template)
		for role, want := range map[httpapi.ParentRole][]string{httpapi.ParentRoleMother: tc.mother, httpapi.ParentRolePartner: tc.partner} {
			if got := planRuleIDs(c, testutil.Parent(t, fam, role)); !slices.Equal(got, want) {
				t.Errorf("%s %s plan = %v, want %v", tc.template, role, got, want)
			}
		}
	}
}

// Recording the data a rule asks for clears the item.
func TestVisionScreenOnFileClearsThePlanItem(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	if !slices.Contains(planRuleIDs(c, mom), "vision-screen") {
		t.Fatal("vision-screen missing before the screening is recorded")
	}
	_, err := c.Pool.Exec(context.Background(),
		`INSERT INTO lab_results (family_id, subject_child_id, owner_member_id, visibility, kind, taken_on)
		 VALUES ($1, $2, $3, 'family', 'vision_screen', $4)`,
		fam.Id, fam.Children[0].Id, mom.Id, testutil.Now)
	if err != nil {
		t.Fatal(err)
	}
	if slices.Contains(planRuleIDs(c, mom), "vision-screen") {
		t.Fatal("vision-screen still in the plan after the screening was recorded")
	}
}

func planRuleIDs(c *testutil.Client, p httpapi.Parent) []string {
	var pl httpapi.Plan
	c.Get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
	ids := []string{}
	for _, it := range pl.Items {
		ids = append(ids, it.RuleId)
	}
	return ids
}
