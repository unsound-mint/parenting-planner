package httpapi_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func day(offset int) string { return testutil.Now.AddDate(0, 0, offset).Format("2006-01-02") }

func startCustom(c *testutil.Client, body map[string]string) httpapi.Family {
	var fam httpapi.Family
	c.Post("/api/demo/custom-sessions", body, http.StatusCreated, &fam)
	return fam
}

func planOf(c *testutil.Client, p httpapi.Parent) map[string]httpapi.PlanItem {
	var pl httpapi.Plan
	c.Get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
	out := map[string]httpapi.PlanItem{}
	for _, it := range pl.Items {
		out[it.RuleId] = it
	}
	return out
}

func TestCustomPregnancyFollowsTheEnteredDueDate(t *testing.T) {
	c := testutil.New(t)
	due := day(70) // 30 weeks pregnant today
	fam := startCustom(c, map[string]string{"stage": "pregnancy", "dueDate": due, "motherName": " Ana ", "partnerName": "Sam"})
	if fam.Template != httpapi.DemoTemplateCustom || fam.Stage != httpapi.StagePregnancy || len(fam.Children) != 0 {
		t.Fatalf("family = %+v", fam)
	}
	if fam.DueDate == nil || fam.DueDate.String() != due || fam.GestationalWeek == nil || *fam.GestationalWeek != 30 {
		t.Fatalf("due %v week %v, want %s and 30", fam.DueDate, fam.GestationalWeek, due)
	}
	mother := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	if mother.DisplayName != "Ana" || partner.DisplayName != "Sam" {
		t.Fatalf("names = %q, %q", mother.DisplayName, partner.DisplayName)
	}

	// The cookie is set: the session now reads this family.
	var got httpapi.Family
	c.Get("/api/family", http.StatusOK, &got)
	if got.Id != fam.Id {
		t.Fatalf("session family = %s, want %s", got.Id, fam.Id)
	}

	// The plan comes from the rules run on the entered due date.
	plan := planOf(c, mother)
	tdap, ok := plan["tdap-pregnancy"]
	if !ok || tdap.Status != httpapi.PlanItemStatusDue {
		t.Fatalf("mother plan = %+v", plan)
	}
	dueDate, _ := time.Parse("2006-01-02", due)
	wantBy := dueDate.AddDate(0, 0, -280+37*7-1).Format("2006-01-02") // last day of week 36
	if tdap.DueBy == nil || tdap.DueBy.String() != wantBy {
		t.Errorf("tdap due by %v, want %s", tdap.DueBy, wantBy)
	}
	if _, ok := plan["glucose-screen"]; !ok {
		t.Errorf("mother plan has no glucose-screen: %+v", plan)
	}
	if _, ok := planOf(c, partner)["tdap-partner"]; !ok {
		t.Errorf("partner plan has no tdap-partner")
	}
}

func TestCustomEarlyPregnancyHasNoThirdTrimesterItems(t *testing.T) {
	c := testutil.New(t)
	fam := startCustom(c, map[string]string{"stage": "pregnancy", "dueDate": day(210), "motherName": "Ana", "partnerName": "Sam"})
	if *fam.GestationalWeek != 10 {
		t.Fatalf("week = %d, want 10", *fam.GestationalWeek)
	}
	plan := planOf(c, testutil.Parent(t, fam, httpapi.ParentRoleMother))
	for _, id := range []string{"glucose-screen", "tdap-pregnancy"} {
		if _, ok := plan[id]; ok {
			t.Errorf("week 10 plan has %s", id)
		}
	}
}

func TestCustomFamilyWithAChildKeepsOnlyTheBirthDate(t *testing.T) {
	c := testutil.New(t)
	born := testutil.Now.AddDate(0, -6, -3).Format("2006-01-02")
	fam := startCustom(c, map[string]string{
		"stage": "infant", "childBirthDate": born, "childName": "Noa", "dueDate": day(30),
		"motherName": "Ana", "partnerName": "Sam",
	})
	if fam.Stage != httpapi.StageInfant || fam.DueDate != nil || fam.GestationalWeek != nil {
		t.Fatalf("family = %+v", fam)
	}
	if len(fam.Children) != 1 || fam.Children[0].Name != "Noa" || fam.Children[0].BirthDate.String() != born || fam.Children[0].AgeMonths != 6 {
		t.Fatalf("children = %+v", fam.Children)
	}

	// The child's name defaults when left out, and nothing is needed before birth.
	fam = startCustom(c, map[string]string{"stage": "postpartum", "childBirthDate": day(-20), "motherName": "Ana", "partnerName": "Sam"})
	if len(fam.Children) != 1 || fam.Children[0].Name != "Baby" {
		t.Fatalf("children = %+v", fam.Children)
	}
	fam = startCustom(c, map[string]string{"stage": "trying", "childBirthDate": day(-20), "childName": "Noa", "motherName": "Ana", "partnerName": "Sam"})
	if len(fam.Children) != 0 || fam.DueDate != nil {
		t.Fatalf("trying family = %+v", fam)
	}
}

func TestCustomFamiliesAreIsolated(t *testing.T) {
	c := testutil.New(t)
	first := startCustom(c, map[string]string{"stage": "pregnancy", "dueDate": day(70), "motherName": "Ana", "partnerName": "Sam"})
	second := startCustom(c, map[string]string{"stage": "pregnancy", "dueDate": day(70), "motherName": "Ana", "partnerName": "Sam"})
	if first.Id == second.Id {
		t.Fatal("two visitors got the same family")
	}
	stranger := testutil.Parent(t, first, httpapi.ParentRoleMother)
	c.Get("/api/members/"+stranger.Id.String()+"/plan", http.StatusNotFound, nil)

	other := testutil.New(t)
	other.Get("/api/family", http.StatusUnauthorized, nil)
}

func TestCustomDetailsAreValidated(t *testing.T) {
	c := testutil.New(t)
	ok := map[string]string{"motherName": "Ana", "partnerName": "Sam"}
	with := func(kv ...string) map[string]string {
		m := map[string]string{}
		for k, v := range ok {
			m[k] = v
		}
		for i := 0; i < len(kv); i += 2 {
			m[kv[i]] = kv[i+1]
		}
		return m
	}
	for name, tc := range map[string]struct {
		body map[string]string
		code string
	}{
		"no due date":          {with("stage", "pregnancy"), "bad_details"},
		"due date too far":     {with("stage", "pregnancy", "dueDate", day(300)), "bad_details"},
		"due date long past":   {with("stage", "pregnancy", "dueDate", day(-30)), "bad_details"},
		"no birth date":        {with("stage", "toddler"), "bad_details"},
		"born in the future":   {with("stage", "postpartum", "childBirthDate", day(3)), "bad_details"},
		"age outside stage":    {with("stage", "infant", "childBirthDate", day(-800)), "bad_details"},
		"blank mother name":    {with("stage", "planning", "motherName", "   "), "bad_details"},
		"dash partner name":    {with("stage", "planning", "partnerName", "-"), "bad_details"},
		"missing partner name": {map[string]string{"stage": "planning", "motherName": "Ana"}, "invalid_request"},
		"unknown stage":        {with("stage", "teen"), "invalid_request"},
		"name too long":        {with("stage", "planning", "motherName", strings.Repeat("a", 41)), "invalid_request"},
	} {
		t.Run(name, func(t *testing.T) {
			var e httpapi.Error
			c.Post("/api/demo/custom-sessions", tc.body, http.StatusBadRequest, &e)
			if e.Code != tc.code {
				t.Errorf("code = %q, want %q (%s)", e.Code, tc.code, e.Message)
			}
		})
	}
	// No family was created by any of them.
	c.Get("/api/family", http.StatusUnauthorized, nil)
}

func TestCustomIsNotADemoTemplate(t *testing.T) {
	c := testutil.New(t)
	var e httpapi.Error
	c.Post("/api/demo/sessions", map[string]string{"template": "custom"}, http.StatusBadRequest, &e)
	if e.Code != "bad_template" {
		t.Fatalf("code = %q", e.Code)
	}
}
