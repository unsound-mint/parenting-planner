package httpapi_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
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

func msPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/mood-screenings" }
func draftPath(m httpapi.Parent, instrument string) string {
	return "/api/members/" + m.Id.String() + "/mood-screening-drafts/" + instrument
}

func TestSharingAResultShowsThePartnerTheBandOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var made httpapi.MoodScreeningResult
	c.Post(msPath(mom), epdsInput(epdsSelfHarm, httpapi.VisibilityPrivate), http.StatusCreated, &made)
	if !made.Urgent || made.Message == nil {
		t.Fatalf("setup: the self-harm answer is urgent for its author: %+v", made)
	}
	seenBy := func(p httpapi.Parent) httpapi.MoodScreeningList {
		var l httpapi.MoodScreeningList
		c.Get(msPath(p), http.StatusOK, &l)
		return l
	}
	if len(seenBy(jake).Items) != 0 {
		t.Fatal("private to begin with")
	}
	var shared httpapi.MoodScreeningResult
	c.Patch(msPath(mom)+"/"+made.Id.String(), map[string]any{"visibility": "partner"}, http.StatusOK, &shared)
	if shared.Visibility != httpapi.VisibilityPartner || !shared.Urgent || shared.Message == nil {
		t.Errorf("the author still sees everything: %+v", shared)
	}
	got := seenBy(jake).Items
	if len(got) != 1 || got[0].Id != made.Id || got[0].Score != made.Score || got[0].Band != made.Band {
		t.Fatalf("Jake sees the band and the score: %+v", got)
	}
	if got[0].Urgent || got[0].Message != nil {
		t.Errorf("Jake never sees the self-harm flag or the message: %+v", got[0])
	}
	// Taking it back hides it again.
	c.Patch(msPath(mom)+"/"+made.Id.String(), map[string]any{"visibility": "private"}, http.StatusOK, nil)
	if len(seenBy(jake).Items) != 0 {
		t.Error("unsharing hides it")
	}
	if n := c.AuditCount(fam.Id, "update", "mood_screening"); n != 2 {
		t.Errorf("update audit rows = %d, want 2", n)
	}
}

func TestOnlyTheAuthorSharesAndOnlyPrivateOrPartner(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var made httpapi.MoodScreeningResult
	c.Post(msPath(mom), epdsInput(epdsGreen, httpapi.VisibilityPartner), http.StatusCreated, &made)
	path := msPath(mom) + "/" + made.Id.String()
	for _, v := range []string{"care_team", "family", "everyone"} {
		c.Patch(path, map[string]any{"visibility": v}, http.StatusBadRequest, nil)
	}
	c.Patch(path, map[string]any{}, http.StatusBadRequest, nil)
	// Jake can read it but it is not his to change; 404 does not reveal that it exists.
	c.Patch(msPath(jake)+"/"+made.Id.String(), map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
	c.Patch(msPath(mom)+"/"+uuid.NewString(), map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
	for _, cg := range fam.Caregivers {
		c.Patch("/api/members/"+cg.Id.String()+"/mood-screenings/"+made.Id.String(), map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
	}
	testutil.New(t).Patch(path, map[string]any{"visibility": "private"}, http.StatusUnauthorized, nil)
}

func TestSavingAndResumingADraft(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var d httpapi.MoodScreeningDraft
	c.Put(draftPath(mom, "epds"), map[string]any{"answers": []int{1, 0, 3}}, http.StatusOK, &d)
	if d.Instrument != httpapi.Epds || len(d.Answers) != 3 || d.Answers[2] != 3 || !d.UpdatedAt.Equal(testutil.Now) {
		t.Errorf("draft = %+v", d)
	}
	c.Put(draftPath(mom, "phq9"), map[string]any{"answers": []int{}}, http.StatusOK, nil) // an empty draft is allowed
	c.Put(draftPath(mom, "epds"), map[string]any{"answers": []int{1, 0, 3, 2}}, http.StatusOK, nil)

	var l httpapi.MoodScreeningDraftList
	c.Get("/api/members/"+mom.Id.String()+"/mood-screening-drafts", http.StatusOK, &l)
	if len(l.Items) != 2 {
		t.Fatalf("one draft per instrument: %+v", l.Items)
	}
	for _, it := range l.Items {
		if it.Instrument == httpapi.Epds && len(it.Answers) != 4 {
			t.Errorf("the draft was replaced: %+v", it)
		}
	}
	// Never visible to the partner, and it never scores or feeds the plan.
	var jl httpapi.MoodScreeningDraftList
	c.Get("/api/members/"+jake.Id.String()+"/mood-screening-drafts", http.StatusOK, &jl)
	if len(jl.Items) != 0 {
		t.Errorf("a draft is private to its author: %+v", jl.Items)
	}
	var results httpapi.MoodScreeningList
	c.Get(msPath(mom), http.StatusOK, &results)
	if len(results.Items) != 0 {
		t.Errorf("a draft is not a result: %+v", results.Items)
	}
	// Finishing the questionnaire deletes its draft; the other instrument's stays.
	c.Post(msPath(mom), epdsInput(epdsGreen, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	c.Get("/api/members/"+mom.Id.String()+"/mood-screening-drafts", http.StatusOK, &l)
	if len(l.Items) != 1 || l.Items[0].Instrument != httpapi.Phq9 {
		t.Errorf("after finishing epds only the phq9 draft is left: %+v", l.Items)
	}
	// Deleting is 204 even with nothing to delete.
	c.Delete(draftPath(mom, "phq9"), http.StatusNoContent, nil)
	c.Delete(draftPath(mom, "phq9"), http.StatusNoContent, nil)
	c.Get("/api/members/"+mom.Id.String()+"/mood-screening-drafts", http.StatusOK, &l)
	if len(l.Items) != 0 {
		t.Errorf("drafts = %+v", l.Items)
	}
}

func TestDraftValidationExpiryAndAccess(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Put(draftPath(mom, "epds"), map[string]any{"answers": []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, http.StatusBadRequest, nil) // 11 answers for 10 questions
	c.Put(draftPath(mom, "phq9"), map[string]any{"answers": []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, http.StatusBadRequest, nil)    // 10 for 9
	c.Put(draftPath(mom, "epds"), map[string]any{"answers": []int{4}}, http.StatusBadRequest, nil)                               // not a printed score
	c.Put(draftPath(mom, "epds"), map[string]any{"answers": []int{-1}}, http.StatusBadRequest, nil)
	c.Put(draftPath(mom, "epds"), map[string]any{}, http.StatusBadRequest, nil)
	c.Put(draftPath(mom, "gad7"), map[string]any{"answers": []int{0}}, http.StatusBadRequest, nil)

	// A draft older than 14 days is dropped.
	c.Put(draftPath(mom, "epds"), map[string]any{"answers": []int{1}}, http.StatusOK, nil)
	if _, err := c.Pool.Exec(context.Background(), `UPDATE mood_screening_drafts SET updated_at = $1 WHERE owner_member_id = $2`, testutil.Now.Add(-15*24*time.Hour), mom.Id); err != nil {
		t.Fatal(err)
	}
	var l httpapi.MoodScreeningDraftList
	c.Get("/api/members/"+mom.Id.String()+"/mood-screening-drafts", http.StatusOK, &l)
	if len(l.Items) != 0 {
		t.Errorf("an old draft must not be returned: %+v", l.Items)
	}
	// Audited, caregivers and other families get nothing.
	if c.AuditCount(fam.Id, "update", "mood_screening_draft") != 1 || c.AuditCount(fam.Id, "read", "mood_screening_draft") != 1 {
		t.Error("saving and listing drafts must be audited")
	}
	for _, cg := range fam.Caregivers {
		base := "/api/members/" + cg.Id.String() + "/mood-screening-drafts"
		c.Get(base, http.StatusNotFound, nil)
		c.Put(base+"/epds", map[string]any{"answers": []int{1}}, http.StatusNotFound, nil)
		c.Delete(base+"/epds", http.StatusNotFound, nil)
	}
	c.Put(draftPath(mom, "epds"), map[string]any{"answers": []int{1}}, http.StatusOK, nil)
	c.StartDemo("pregnancy") // another family's session now
	c.Get("/api/members/"+mom.Id.String()+"/mood-screening-drafts", http.StatusNotFound, nil)
}
