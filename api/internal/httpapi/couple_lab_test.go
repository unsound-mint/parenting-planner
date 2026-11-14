package httpapi_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func labPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/lab" }

func labCard(t *testing.T, c *testutil.Client, m httpapi.Parent, id string) httpapi.LabCard {
	t.Helper()
	var lab httpapi.CoupleLab
	c.Get(labPath(m), http.StatusOK, &lab)
	for _, card := range lab.Cards {
		if card.Id == id {
			return card
		}
	}
	t.Fatalf("no card %s", id)
	return httpapi.LabCard{}
}

func TestLabHidesAnAnswerUntilBothAnsweredThenRevealsIt(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	// "values-crying" is seeded with Jake's answer only: Emily sees that he answered, never what.
	card := labCard(t, c, mom, "values-crying")
	if !card.PartnerAnswered || card.Mine != nil || card.Reveal != nil {
		t.Fatalf("Emily before answering: %+v", card)
	}
	// She answers differently: the reveal now carries both answers and a conversation prompt.
	var after httpapi.LabCard
	c.Post(labPath(mom)+"-answers", map[string]any{"cardId": "values-crying", "choiceId": "c"}, http.StatusCreated, &after)
	if after.Reveal == nil || after.Reveal.Agree || after.Reveal.Theirs.ChoiceId != "b" || after.Reveal.TalkPrompt.Text == "" {
		t.Fatalf("reveal = %+v", after.Reveal)
	}
	// Both answered: the answer is final.
	c.Post(labPath(mom)+"-answers", map[string]any{"cardId": "values-crying", "choiceId": "a"}, http.StatusConflict, nil)
	// The differing card is on the couple talks list; marking it talked about is shared.
	var together httpapi.Together
	c.Get("/api/members/"+jake.Id.String()+"/together", http.StatusOK, &together)
	found := false
	for _, p := range together.Prompts {
		found = found || p.Id == "lab:values-crying"
	}
	if !found {
		t.Error("a differing lab card must join the couple talks list")
	}
	c.Post("/api/members/"+jake.Id.String()+"/couple-talks", map[string]any{"promptId": "lab:values-crying"}, http.StatusCreated, nil)
	if got := labCard(t, c, mom, "values-crying"); got.Reveal.TalkPrompt.TalkedAt == nil {
		t.Error("talked about is shared by the couple")
	}
}

func TestLabNeverLeaksAPartnersChoiceBeforeYouAnswered(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	// night-who-soothes: only Emily answered ("d"), so Jake sees neither a reveal nor her choice.
	jake := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	card := labCard(t, c, jake, "night-who-soothes")
	if !card.PartnerAnswered || card.Reveal != nil || card.Mine != nil {
		t.Fatalf("Jake: %+v", card)
	}
	_, body := c.Raw("GET", labPath(jake), "", nil)
	// Emily's seeded "d" on that card must not be in the payload except as the card's own choice list.
	if containsTheirs(body) {
		t.Error("the response carries a reveal for an unanswered card")
	}
	// Until the other parent answers, an answer can be changed.
	c.Post(labPath(mom)+"-answers", map[string]any{"cardId": "night-who-soothes", "choiceId": "a"}, http.StatusCreated, nil)
	c.Post(labPath(mom)+"-answers", map[string]any{"cardId": "night-who-soothes", "choiceId": "b"}, http.StatusCreated, nil)
}

func containsTheirs(b []byte) bool {
	var lab httpapi.CoupleLab
	if err := json.Unmarshal(b, &lab); err != nil {
		return true
	}
	for _, card := range lab.Cards {
		if card.Id == "night-who-soothes" && card.Reveal != nil {
			return true
		}
	}
	return false
}

func TestLabAgreementAndSomethingElse(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("planning")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	if card := labCard(t, c, mom, "values-future"); card.Reveal == nil || !card.Reveal.Agree {
		t.Errorf("seeded agreement: %+v", card.Reveal)
	}
	// "Something else" never counts as agreeing, and carries the text.
	other := "Whoever is less tired"
	var got httpapi.LabCard
	c.Post(labPath(mom)+"-answers", map[string]any{"cardId": "visitors-first-weeks", "choiceId": "other", "otherText": other}, http.StatusCreated, &got)
	if got.Reveal == nil || got.Reveal.Agree || got.Mine == nil || got.Mine.OtherText == nil || *got.Mine.OtherText != other {
		t.Errorf("other: %+v", got)
	}
	c.Post(labPath(mom)+"-answers", map[string]any{"cardId": "nope", "choiceId": "a"}, http.StatusNotFound, nil)
	c.Post(labPath(mom)+"-answers", map[string]any{"cardId": "night-split", "choiceId": "z"}, http.StatusBadRequest, nil)
	// A choice that is not on the card is 400 even for a valid letter.
	var lab httpapi.CoupleLab
	c.Get(labPath(mom), http.StatusOK, &lab)
	if n := len(lab.Cards); n < 15 || n > 25 {
		t.Errorf("%d cards, want 15 to 25", n)
	}
	for _, card := range lab.Cards {
		if len(card.Choices) < 3 || len(card.Choices) > 4 {
			t.Errorf("%s has %d answers", card.Id, len(card.Choices))
		}
	}
}

func TestLabIsParentsOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	for _, cg := range fam.Caregivers {
		c.Get("/api/members/"+cg.Id.String()+"/lab", http.StatusNotFound, nil)
		c.Post("/api/members/"+cg.Id.String()+"/lab-answers", map[string]any{"cardId": "night-split", "choiceId": "a"}, http.StatusNotFound, nil)
	}
}
