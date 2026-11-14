package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func thanksPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/thanks" }

func TestThanksSuggestionsAreWordedFromDataAndSentOnce(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get(thanksPath(uuid.New())+"/suggestions", http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	// Emily already thanked Jake for the crib; Jake can thank Emily for the bag.
	var l httpapi.ThanksList
	c.Get(thanksPath(jake.Id), http.StatusOK, &l)
	if len(l.Items) != 1 || l.Items[0].FromMemberId != mom.Id || l.Items[0].ToMemberId != jake.Id || !strings.Contains(l.Items[0].Body, "crib") {
		t.Fatalf("seeded exchange = %+v", l.Items)
	}
	var s httpapi.ThanksSuggestionList
	c.Get(thanksPath(mom.Id)+"/suggestions", http.StatusOK, &s)
	for _, it := range s.Items {
		if it.Basis == httpapi.ThanksBasisTasksDone && it.ToMemberId == jake.Id {
			t.Errorf("the crib was thanked already: %+v", it)
		}
	}
	c.Get(thanksPath(jake.Id)+"/suggestions", http.StatusOK, &s)
	// Missions Emily finished add a tasks_done suggestion; the bag one is the one this test sends.
	var bag httpapi.ThanksSuggestion
	for _, it := range s.Items {
		if it.Basis == httpapi.ThanksBasisBagItems {
			bag = it
		}
	}
	if bag.ToMemberId != mom.Id || bag.Text != "Thank you for packing 3 bag items." {
		t.Fatalf("Jake's suggestions = %+v", s.Items)
	}

	body := "Thank you for packing 3 bag items. It lifted a weight."
	var sent httpapi.Thanks
	c.Post(thanksPath(jake.Id), map[string]any{"toMemberId": mom.Id, "body": body, "suggestionKey": bag.Key}, http.StatusCreated, &sent)
	if sent.FromMemberId != jake.Id || sent.ToMemberId != mom.Id || sent.Body != body {
		t.Errorf("sent = %+v", sent)
	}
	c.Post(thanksPath(jake.Id), map[string]any{"toMemberId": mom.Id, "body": body, "suggestionKey": bag.Key}, http.StatusConflict, nil)
	c.Get(thanksPath(jake.Id)+"/suggestions", http.StatusOK, &s)
	for _, it := range s.Items {
		if it.Key == bag.Key {
			t.Errorf("a thanked suggestion is not offered again: %+v", s.Items)
		}
	}
	c.Get(thanksPath(mom.Id), http.StatusOK, &l)
	if len(l.Items) != 2 || l.Items[0].Id != sent.Id {
		t.Errorf("Emily sees the new note first: %+v", l.Items)
	}
}

func TestThanksValidation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	c.Post(thanksPath(mom.Id), map[string]any{"toMemberId": mom.Id, "body": "me"}, http.StatusConflict, nil)
	c.Post(thanksPath(mom.Id), map[string]any{"toMemberId": uuid.New(), "body": "who"}, http.StatusBadRequest, nil)
	c.Post(thanksPath(mom.Id), map[string]any{"toMemberId": jake.Id, "body": ""}, http.StatusBadRequest, nil)
	c.Post(thanksPath(mom.Id), map[string]any{"toMemberId": jake.Id, "body": "   "}, http.StatusBadRequest, nil)
	c.Post(thanksPath(mom.Id), map[string]any{"toMemberId": jake.Id, "body": strings.Repeat("x", 401)}, http.StatusBadRequest, nil)
	// A member of another family is not a valid recipient.
	other := testutil.New(t)
	otherFam := other.StartDemo("pregnancy")
	c.Post(thanksPath(mom.Id), map[string]any{"toMemberId": testutil.Parent(t, otherFam, httpapi.ParentRolePartner).Id, "body": "hi"}, http.StatusBadRequest, nil)
}

func TestThanksCaregiversNeverSendAndSeeOnlyTheirOwn(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var grandma, nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleGrandparent {
			grandma = cg
		} else {
			nanny = cg
		}
	}
	// A parent thanks the grandmother; the note to Jake stays out of her view.
	var sent httpapi.Thanks
	c.Post(thanksPath(mom.Id), map[string]any{"toMemberId": grandma.Id, "body": "Thank you for Tuesday, Linda."}, http.StatusCreated, &sent)

	var l httpapi.ThanksList
	c.Get(thanksPath(grandma.Id), http.StatusOK, &l)
	if len(l.Items) != 1 || l.Items[0].Id != sent.Id {
		t.Errorf("the grandmother sees only her note: %+v", l.Items)
	}
	c.Get(thanksPath(nanny.Id), http.StatusOK, &l)
	if len(l.Items) != 0 {
		t.Errorf("the nanny sees nothing: %+v", l.Items)
	}
	c.Get(thanksPath(jake.Id), http.StatusOK, &l)
	if len(l.Items) != 2 {
		t.Errorf("both parents see every note, got %d", len(l.Items))
	}
	c.Post(thanksPath(grandma.Id), map[string]any{"toMemberId": mom.Id, "body": "hi"}, http.StatusForbidden, nil)
	c.Get(thanksPath(grandma.Id)+"/suggestions", http.StatusForbidden, nil)
}

func TestThanksNewbornSuggestsFromCareLogIncludingCaregivers(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	aisha, marcus := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var s httpapi.ThanksSuggestionList
	c.Get(thanksPath(aisha.Id)+"/suggestions", http.StatusOK, &s)
	var grandma bool
	for _, it := range s.Items {
		if it.ToMemberId == marcus.Id && it.Basis == httpapi.ThanksBasisNightFeeds {
			t.Errorf("Aisha already thanked Marcus for that night: %+v", it)
		}
		grandma = grandma || it.Basis == httpapi.ThanksBasisCaregiverCare
	}
	if !grandma {
		t.Errorf("Aisha can thank the grandmother for yesterday's feed: %+v", s.Items)
	}
	c.Get(thanksPath(marcus.Id)+"/suggestions", http.StatusOK, &s)
	var feeds bool
	for _, it := range s.Items {
		feeds = feeds || (it.ToMemberId == aisha.Id && (it.Basis == httpapi.ThanksBasisFeeds || it.Basis == httpapi.ThanksBasisNightFeeds))
		if strings.Contains(strings.ToLower(it.Text), "mood") || strings.Contains(strings.ToLower(it.Text), "diary") {
			t.Errorf("never from private data: %q", it.Text)
		}
	}
	if !feeds {
		t.Errorf("Marcus can thank Aisha for feeds: %+v", s.Items)
	}
}
