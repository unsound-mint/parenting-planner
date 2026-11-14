package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func epdsInput(answers []int, vis httpapi.Visibility) httpapi.MoodScreeningInput {
	return httpapi.MoodScreeningInput{Instrument: httpapi.Epds, Answers: answers, Visibility: vis}
}

var (
	epdsGreen    = []int{1, 0, 1, 0, 0, 1, 0, 0, 0, 0}
	epdsAmber    = []int{1, 1, 1, 1, 1, 1, 1, 1, 2, 0}
	epdsRed      = []int{2, 2, 2, 1, 1, 1, 1, 1, 2, 0}
	epdsSelfHarm = []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 1} // "Hardly ever" on item 10
)

func planHas(t *testing.T, c *testutil.Client, memberPath, ruleID string) bool {
	t.Helper()
	var pl httpapi.Plan
	c.Get(memberPath+"/plan", http.StatusOK, &pl)
	for _, it := range pl.Items {
		if it.RuleId == ruleID {
			return true
		}
	}
	return false
}

func TestScreeningQuestionnaires(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	for _, tc := range []struct {
		role      httpapi.ParentRole
		suggested bool
	}{
		{httpapi.ParentRolePartner, true}, // Marcus has not taken one yet
		{httpapi.ParentRoleMother, false}, // Aisha took one two weeks ago
	} {
		var list httpapi.ScreeningQuestionnaireList
		c.Get("/api/members/"+testutil.Parent(t, fam, tc.role).Id.String()+"/screening-questionnaires", http.StatusOK, &list)
		if len(list.Items) != 2 || list.Items[0].Instrument != httpapi.Epds || list.Items[1].Instrument != httpapi.Phq9 {
			t.Fatalf("%s: got %+v", tc.role, list.Items)
		}
		epds, phq := list.Items[0], list.Items[1]
		if len(epds.Questions) != 10 || len(phq.Questions) != 9 {
			t.Errorf("question counts %d and %d, want 10 and 9", len(epds.Questions), len(phq.Questions))
		}
		if epds.Suggested != tc.suggested || phq.Suggested {
			t.Errorf("%s: suggested epds=%v phq9=%v, want epds=%v", tc.role, epds.Suggested, phq.Suggested, tc.suggested)
		}
		if q3 := epds.Questions[2]; q3.Choices[0].Value != 3 || q3.Choices[3].Value != 0 {
			t.Errorf("EPDS question 3 is reverse scored, got %+v", q3.Choices)
		}
		if epds.Source.Url == "" || phq.Source.Url == "" {
			t.Error("every questionnaire cites its source")
		}
	}
}

func TestMoodScreeningValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/mood-screenings"

	var e httpapi.Error
	c.Post(path, epdsInput([]int{0, 0, 0, 0, 0, 0, 0, 0, 0}, httpapi.VisibilityPrivate), http.StatusBadRequest, &e)
	if e.Code != "invalid_request" {
		t.Errorf("code = %q", e.Code)
	}
	c.Post(path, httpapi.MoodScreeningInput{Instrument: httpapi.Phq9, Answers: epdsGreen, Visibility: httpapi.VisibilityPrivate}, http.StatusBadRequest, nil)
	c.Post(path, epdsInput([]int{0, 0, 0, 0, 0, 0, 0, 0, 0, 4}, httpapi.VisibilityPrivate), http.StatusBadRequest, nil)
	c.Post(path, map[string]any{"instrument": "epds", "answers": epdsGreen}, http.StatusBadRequest, nil)
	c.Post("/api/members/00000000-0000-4000-8000-000000000001/mood-screenings", epdsInput(epdsGreen, httpapi.VisibilityPrivate), http.StatusNotFound, nil)
}

func TestMoodScreeningScoring(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/mood-screenings"

	var r httpapi.MoodScreeningResult
	c.Post(path, epdsInput(epdsRed, httpapi.VisibilityPrivate), http.StatusCreated, &r)
	if r.Score != 13 || r.MaxScore != 30 || r.Band != httpapi.Red || r.Urgent || r.Message == nil || r.Source.Url == "" {
		t.Errorf("red result: %+v", r)
	}
	c.Post(path, epdsInput(epdsSelfHarm, httpapi.VisibilityPrivate), http.StatusCreated, &r)
	if !r.Urgent || r.Band != httpapi.Green || r.Score != 1 || r.Message == nil {
		t.Errorf("self-harm answer must be urgent whatever the total: %+v", r)
	}
	var red httpapi.MoodScreeningResult
	c.Post(path, epdsInput(epdsRed, httpapi.VisibilityPrivate), http.StatusCreated, &red)
	if *r.Message == *red.Message {
		t.Error("an urgent result gets the fixed urgent wording, not the band's")
	}
}

func TestMoodScreeningPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	momPath := "/api/members/" + mom.Id.String() + "/mood-screenings"
	partnerPath := "/api/members/" + partner.Id.String() + "/mood-screenings"

	c.Post(momPath, epdsInput(epdsRed, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	c.Post(momPath, epdsInput(epdsSelfHarm, httpapi.VisibilityPartner), http.StatusCreated, nil)
	c.Post(momPath, epdsInput(epdsAmber, httpapi.VisibilityCareTeam), http.StatusCreated, nil)

	var own, seen httpapi.MoodScreeningList
	c.Get(momPath, http.StatusOK, &own)
	c.Get(partnerPath, http.StatusOK, &seen)
	if len(own.Items) != 3 {
		t.Errorf("author sees %d results, want 3", len(own.Items))
	}
	if len(seen.Items) != 1 || seen.Items[0].Visibility != httpapi.VisibilityPartner {
		t.Fatalf("partner must see only the shared result, got %+v", seen.Items)
	}
	if s := seen.Items[0]; s.Urgent || s.Message != nil || s.Band != httpapi.Green {
		t.Errorf("someone else's result never shows the self-harm answer: %+v", s)
	}
	// The mother's results never reach the partner's plan.
	if planHas(t, c, "/api/members/"+partner.Id.String(), "epds-talk-to-doctor") {
		t.Error("the mother's result must not add items to the partner's plan")
	}
}

func TestMoodScreeningIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/mood-screenings"

	c.Post(path, epdsInput(epdsGreen, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	c.Get(path, http.StatusOK, nil)
	if n := c.AuditCount(fam.Id, "create", "mood_screening"); n != 1 {
		t.Errorf("create audit rows = %d, want 1", n)
	}
	if n := c.AuditCount(fam.Id, "read", "mood_screening"); n != 1 {
		t.Errorf("read audit rows = %d, want 1", n)
	}
}

func TestMoodScreeningChangesThePlan(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	partner := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRolePartner).Id.String()
	mom := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()

	if !planHas(t, c, partner, "mood-screen-partner") {
		t.Fatal("the father's plan asks for a questionnaire in the newborn demo")
	}
	if planHas(t, c, mom, "mood-screen-mother") {
		t.Error("the mother's seeded questionnaire settles her item")
	}
	c.Post(partner+"/mood-screenings", epdsInput(epdsAmber, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	if planHas(t, c, partner, "mood-screen-partner") {
		t.Error("taking the questionnaire settles the item")
	}
	if !planHas(t, c, partner, "epds-repeat") {
		t.Error("an amber result asks to repeat it in two weeks")
	}
	// A red result in another family (the test clock does not move, so two
	// results in one family would share a time).
	fam2 := c.StartDemo("newborn")
	partner2 := "/api/members/" + testutil.Parent(t, fam2, httpapi.ParentRolePartner).Id.String()
	mom2 := "/api/members/" + testutil.Parent(t, fam2, httpapi.ParentRoleMother).Id.String()
	c.Post(partner2+"/mood-screenings", epdsInput(epdsRed, httpapi.VisibilityPartner), http.StatusCreated, nil)
	if !planHas(t, c, partner2, "epds-talk-to-doctor") || planHas(t, c, partner2, "epds-repeat") {
		t.Error("a red result adds talk to your doctor, not the repeat item")
	}
	if planHas(t, c, mom2, "epds-talk-to-doctor") {
		t.Error("a shared result still feeds only its author's plan")
	}
}

// Replaced by real tests when the [BE] issue for sharing and drafts lands.
func TestMoodScreeningSharingAndDraftsAreNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"PATCH", m + "/mood-screenings/00000000-0000-4000-8000-000000000001", map[string]any{"visibility": "partner"}},
		{"GET", m + "/mood-screening-drafts", nil},
		{"PUT", m + "/mood-screening-drafts/epds", map[string]any{"answers": []int{0, 1, 2}}},
		{"DELETE", m + "/mood-screening-drafts/epds", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
