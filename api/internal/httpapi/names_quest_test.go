package httpapi_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func cardNames(cs []httpapi.NameCard) []string {
	out := make([]string, 0, len(cs))
	for _, c := range cs {
		out = append(out, c.Name)
	}
	return out
}

func stageDone(q httpapi.NamesQuest, id httpapi.NameQuestStageId) bool {
	for _, s := range q.Stages {
		if s.Id == id {
			return s.Done
		}
	}
	return false
}

func talkNames(q httpapi.NamesQuest) []string {
	var out []string
	for _, t := range q.TalkAbout {
		out = append(out, t.Card.Name)
	}
	return out
}

// The seeded quest at week 25, and the core privacy rule: a parent's answer
// on a name reaches the other parent only after they answered it too.
func TestNamesQuestHidesAnswersUntilBothAnswered(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	quest := memberPath(mom.Id) + "/names-quest"

	var q httpapi.NamesQuest
	c.Get(quest, http.StatusOK, &q)
	if strings.Join(q.Chosen, ",") != "english,irish,french,vintage" || q.Year < 2024 || len(q.Sources) != 2 {
		t.Errorf("chosen %v, year %d, sources %d", q.Chosen, q.Year, len(q.Sources))
	}
	if got := cardNames(q.Matches); strings.Join(got, ",") != "Hazel,Theo,June,Ada" {
		t.Errorf("matches = %v", got)
	}
	if !stageDone(q, httpapi.Lists) || stageDone(q, httpapi.Matches) || q.PairCount != 0 || len(q.NextPair) != 0 {
		t.Errorf("stages %+v, pairs %d", q.Stages, q.PairCount)
	}
	// Twelve swipes plus June, which Jake typed and Emily liked; Jake has thirteen plus Ada and Theo.
	if q.Progress[0].MemberId != mom.Id || q.Progress[0].Swiped != 13 || q.Progress[1].Swiped != 15 {
		t.Errorf("progress = %+v", q.Progress)
	}
	if got := talkNames(q); strings.Join(got, ",") != "Eleanor,Finn,Iris" {
		t.Errorf("talk about = %v", got)
	}

	// Miles, which Jake typed, comes first; then his answers on names Emily
	// has not seen, without saying what they were.
	var deck httpapi.NameDeck
	c.Get(quest+"/deck", http.StatusOK, &deck)
	if deck.Items[0].Name != "Miles" || deck.Items[0].AddedBy == nil || *deck.Items[0].AddedBy != dad.Id {
		t.Errorf("deck starts with %+v", deck.Items[0])
	}
	next := cardNames(deck.Items[1:7])
	slices.Sort(next)
	if strings.Join(next, ",") != "Eloise,Grace,Leo,Rowan,Sophie,Willow" || deck.Remaining < len(deck.Items) {
		t.Errorf("deck goes on with %v (remaining %d)", next, deck.Remaining)
	}
	for _, card := range deck.Items {
		if slices.Contains([]string{"Hazel", "Iris", "Henry", "Josephine"}, card.Name) {
			t.Errorf("answered name %s is in the deck", card.Name)
		}
	}

	// Nothing else tells Emily that Jake loves Eloise before she answers.
	var names httpapi.BabyNameList
	c.Get(memberPath(mom.Id)+"/baby-names", http.StatusOK, &names)
	var together httpapi.Together
	c.Get(memberPath(mom.Id)+"/together", http.StatusOK, &together)
	for _, n := range names.Items {
		if n.Name == "Eloise" || n.Name == "Rowan" {
			t.Errorf("%s is on the shared list before Emily answered", n.Name)
		}
	}
	if together.Nudge != nil && strings.Contains(together.Nudge.Text, "Eloise") {
		t.Errorf("nudge leaks a swipe: %q", together.Nudge.Text)
	}

	var r httpapi.NameSwipeResult
	c.Post(quest+"/swipes", map[string]any{"name": "eloise", "verdict": "maybe"}, http.StatusOK, &r)
	if r.Name != "Eloise" || r.Match || r.Theirs == nil || *r.Theirs != httpapi.Love {
		t.Errorf("maybe on Eloise = %+v", r)
	}
	c.Post(quest+"/swipes", map[string]any{"name": "Rowan", "verdict": "love"}, http.StatusOK, &r)
	if !r.Match || r.Card == nil || r.Card.Id == nil {
		t.Errorf("love on Rowan = %+v", r)
	}
	c.Get(quest, http.StatusOK, &q)
	if !slices.Contains(talkNames(q), "Eloise") || len(q.Matches) != 5 || !stageDone(q, httpapi.Matches) || q.PairCount != 10 || len(q.NextPair) != 2 {
		t.Errorf("after the match: talk %v, matches %v, pairs %d", talkNames(q), cardNames(q.Matches), q.PairCount)
	}

	// Jake's side: Emily's "maybe" on Claire stays hidden until he answers it.
	dq := memberPath(dad.Id) + "/names-quest"
	c.Get(dq, http.StatusOK, &q)
	if slices.Contains(talkNames(q), "Claire") {
		t.Error("Claire is shown to Jake before he answered")
	}
	c.Post(dq+"/swipes", map[string]any{"name": "Claire", "verdict": "love"}, http.StatusOK, &r)
	if r.Theirs == nil || *r.Theirs != httpapi.Maybe || r.Match {
		t.Errorf("Jake's love on Claire = %+v", r)
	}
	c.Delete(dq+"/swipes/Claire", http.StatusNoContent, nil)
	c.Delete(dq+"/swipes/Claire", http.StatusNoContent, nil) // idempotent
	c.Get(dq+"/deck", http.StatusOK, &deck)
	if !slices.Contains(cardNames(deck.Items), "Claire") {
		t.Error("an undone name is back in the deck")
	}

	c.Post(quest+"/swipes", map[string]any{"name": "Zzyzx", "verdict": "love"}, http.StatusNotFound, nil)
	c.Post(quest+"/swipes", map[string]any{"name": "Hazel", "verdict": "meh"}, http.StatusBadRequest, nil)
}

// Five matches open the final round; both parents' picks make the top three.
func TestNamesQuestFinalRound(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	quest := memberPath(mom.Id) + "/names-quest"

	var q httpapi.NamesQuest
	c.Get(quest, http.StatusOK, &q)
	c.Post(quest+"/duels", map[string]any{"winnerId": q.Matches[0].Id, "loserId": q.Matches[1].Id}, http.StatusConflict, nil)
	c.Post(quest+"/swipes", map[string]any{"name": "Willow", "verdict": "love"}, http.StatusOK, nil)

	play := func(path string) httpapi.NamesQuest {
		t.Helper()
		var q httpapi.NamesQuest
		c.Get(path, http.StatusOK, &q)
		for i := 0; len(q.NextPair) == 2; i++ {
			if i > 20 {
				t.Fatal("the final round does not end")
			}
			// Always prefer the name that comes first in the alphabet.
			w, l := q.NextPair[0], q.NextPair[1]
			if l.Name < w.Name {
				w, l = l, w
			}
			c.Post(path+"/duels", map[string]any{"winnerId": w.Id, "loserId": l.Id}, http.StatusOK, &q)
		}
		return q
	}
	q = play(quest)
	if q.Progress[0].Judged != q.PairCount || q.FinishedAt != nil || len(q.Top) != 3 {
		t.Errorf("after Emily: judged %d of %d, finished %v, top %v", q.Progress[0].Judged, q.PairCount, q.FinishedAt, cardNames(q.Top))
	}
	q = play(memberPath(dad.Id) + "/names-quest")
	if q.FinishedAt == nil || !stageDone(q, httpapi.Final) || strings.Join(cardNames(q.Top), ",") != "Ada,Hazel,June" {
		t.Errorf("after both: finished %v, top %v", q.FinishedAt, cardNames(q.Top))
	}

	c.Post(quest+"/duels", map[string]any{"winnerId": q.Top[0].Id, "loserId": q.Top[0].Id}, http.StatusBadRequest, nil)
	var names httpapi.BabyNameList
	c.Get(memberPath(mom.Id)+"/baby-names", http.StatusOK, &names)
	var miles httpapi.BabyName
	for _, n := range names.Items {
		if n.Name == "Miles" {
			miles = n
		}
	}
	c.Post(quest+"/duels", map[string]any{"winnerId": miles.Id, "loserId": q.Top[0].Id}, http.StatusNotFound, nil)
}

// A name one parent loved in the deck and the other types in is a match; taking
// back a like takes back the love.
func TestNamesQuestMeetsTheSharedList(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var n httpapi.BabyName
	c.Post(memberPath(dad.Id)+"/baby-names", map[string]any{"name": "violet"}, http.StatusCreated, &n)
	if !n.BothLike {
		t.Errorf("Emily loved Violet in the deck; Jake typing it is a match: %+v", n)
	}
	c.Delete(memberPath(mom.Id)+"/baby-names/"+n.Id.String()+"/like", http.StatusOK, &n)
	var q httpapi.NamesQuest
	c.Get(memberPath(mom.Id)+"/names-quest", http.StatusOK, &q)
	if slices.Contains(cardNames(q.Matches), "Violet") {
		t.Error("Violet is still a match after Emily took back her like")
	}

	// A name a parent typed shows in the other parent's deck, with who added it.
	c.Post(memberPath(mom.Id)+"/baby-names", map[string]any{"name": "Wren"}, http.StatusCreated, &n)
	var deck httpapi.NameDeck
	c.Get(memberPath(dad.Id)+"/names-quest/deck", http.StatusOK, &deck)
	wren := slices.IndexFunc(deck.Items, func(c httpapi.NameCard) bool { return c.Name == "Wren" })
	if wren < 0 || wren > 1 || deck.Items[wren].AddedBy == nil || *deck.Items[wren].AddedBy != mom.Id {
		t.Errorf("Jake's deck starts with %v", cardNames(deck.Items[:2]))
	}

	// Filters: girls only and rare names only.
	rare := 300
	c.Get(memberPath(dad.Id)+"/names-quest/deck?sex=girl&maxBabies=300", http.StatusOK, &deck)
	for _, card := range deck.Items {
		if card.Popularity != nil && (card.Popularity.Babies > rare || *card.Sex == httpapi.Boy) {
			t.Errorf("filtered deck has %s (%+v)", card.Name, card.Popularity)
		}
	}

	c.Put(memberPath(mom.Id)+"/names-quest/lists", map[string]any{"lists": []string{"klingon"}}, http.StatusBadRequest, nil)
	c.Put(memberPath(mom.Id)+"/names-quest/lists", map[string]any{"lists": []string{}}, http.StatusBadRequest, nil)
	c.Put(memberPath(mom.Id)+"/names-quest/lists", map[string]any{"lists": []string{"japanese", "japanese", "korean"}}, http.StatusOK, &q)
	if strings.Join(q.Chosen, ",") != "japanese,korean" {
		t.Errorf("chosen = %v", q.Chosen)
	}
}

// Caregivers never reach the quest, and it is closed after the birth.
func TestNamesQuestIsForParentsBeforeTheBirth(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	calls := func(m string, status int) {
		t.Helper()
		q := m + "/names-quest"
		c.Get(q, status, nil)
		c.Put(q+"/lists", map[string]any{"lists": []string{"irish"}}, status, nil)
		c.Get(q+"/deck", status, nil)
		c.Post(q+"/swipes", map[string]any{"name": "Maeve", "verdict": "love"}, status, nil)
		c.Delete(q+"/swipes/Maeve", status, nil)
		c.Post(q+"/duels", map[string]any{"winnerId": fam.Parents[0].Id, "loserId": fam.Parents[1].Id}, status, nil)
	}
	for _, cg := range fam.Caregivers {
		calls(memberPath(cg.Id), http.StatusNotFound)
	}
	newborn := c.StartDemo("newborn")
	calls(memberPath(testutil.Parent(t, newborn, httpapi.ParentRoleMother).Id), http.StatusConflict)

	planning := c.StartDemo("planning")
	var q httpapi.NamesQuest
	c.Get(memberPath(testutil.Parent(t, planning, httpapi.ParentRoleMother).Id)+"/names-quest", http.StatusOK, &q)
	if got := cardNames(q.Matches); len(got) != 2 || !slices.Contains(got, "River") || len(q.TalkAbout) != 3 {
		t.Errorf("planning: matches %v, talk %v", got, talkNames(q))
	}
}
