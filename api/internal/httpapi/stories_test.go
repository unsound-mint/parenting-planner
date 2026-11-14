package httpapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/ai"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func storiesPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/stories" }

func storyPath(member, story uuid.UUID) string { return storiesPath(member) + "/" + story.String() }

func storyInput(childID *uuid.UUID, theme, vis string, memories ...string) map[string]any {
	ms := []map[string]string{}
	for _, m := range memories {
		ms = append(ms, map[string]string{"text": m})
	}
	in := map[string]any{"theme": theme, "visibility": vis, "memories": ms}
	if childID != nil {
		in["childId"] = *childID
	}
	return in
}

func storyTitles(c *testutil.Client, m uuid.UUID) map[string]httpapi.Story {
	var l httpapi.StoryList
	c.Get(storiesPath(m), http.StatusOK, &l)
	out := map[string]httpapi.Story{}
	for _, s := range l.Items {
		out[s.Title] = s
	}
	return out
}

func TestStoryValidation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	leo := fam.Children[0].Id
	p := storiesPath(mom.Id)
	c.Post(p, storyInput(&leo, "bedtime", "private"), http.StatusBadRequest, nil) // no memories
	c.Post(p, storyInput(&leo, "bedtime", "family", "a walk"), http.StatusBadRequest, nil)
	c.Post(p, storyInput(&leo, "bedtime", "care_team", "a walk"), http.StatusBadRequest, nil)
	c.Post(p, storyInput(&leo, "pirates", "private", "a walk"), http.StatusBadRequest, nil)
	c.Post(p, storyInput(&leo, "bedtime", "private", "a", "b", "c", "d", "e"), http.StatusBadRequest, nil)
	c.Post(p, storyInput(&leo, "bedtime", "private", strings.Repeat("x", 281)), http.StatusBadRequest, nil)
	c.Post(p, storyInput(&leo, "bedtime", "private", "555-0164 1234"), http.StatusBadRequest, nil) // nothing left after cleaning
	other := uuid.New()
	c.Post(p, storyInput(&other, "bedtime", "private", "a walk"), http.StatusBadRequest, nil)
	c.Post(p, storyInput(nil, "bedtime", "private", "a walk"), http.StatusBadRequest, nil) // neither child nor name
	testutil.New(t).Post(p, storyInput(&leo, "bedtime", "private", "a walk"), http.StatusUnauthorized, nil)
	testutil.New(t).Get(p, http.StatusUnauthorized, nil)
}

func TestStoriesUseTheTemplateWithoutAKeyAndArePrivateUntilShared(t *testing.T) {
	c := testutil.NewWithConfig(t, httpapi.Config{})
	fam := c.StartDemo("newborn")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	leo := fam.Children[0].Id

	// The seeded book is shared, so both parents see it.
	var l httpapi.StoryList
	c.Get(storiesPath(dad.Id), http.StatusOK, &l)
	if l.AiEnabled || len(l.Items) != 1 || l.Items[0].AuthorId != mom.Id || l.Items[0].ChildName != "Leo" {
		t.Fatalf("seeded shelf = %+v", l)
	}

	var made httpapi.Story
	c.Post(storiesPath(dad.Id), storyInput(&leo, "adventure", "private",
		"You kicked your legs at the ceiling fan like it was a parade", "We walked to the pond and you slept the whole way"), http.StatusCreated, &made)
	if made.GeneratedBy != httpapi.Template || made.SignedAs != "Daddy" || made.ChildName != "Leo" || made.AgeMonths == nil || *made.AgeMonths != 1 {
		t.Errorf("created = %+v", made)
	}
	if n := len(made.Pages); n < 6 || n > 10 {
		t.Errorf("%d pages", n)
	}
	text := ""
	for _, p := range made.Pages {
		text += p.Text + " "
	}
	if !strings.Contains(text, "ceiling fan like it was a parade.") || !strings.Contains(text, "Leo") || !strings.Contains(text, "Daddy") {
		t.Errorf("the memories and names must be in the book: %s", text)
	}

	// Private: the other parent cannot list, read, share or delete it.
	if _, ok := storyTitles(c, mom.Id)[made.Title]; ok {
		t.Error("Mom sees Dad's private story")
	}
	c.Get(storyPath(mom.Id, made.Id), http.StatusNotFound, nil)
	c.Patch(storyPath(mom.Id, made.Id), map[string]string{"visibility": "partner"}, http.StatusNotFound, nil)
	c.Delete(storyPath(mom.Id, made.Id), http.StatusNotFound, nil)
	c.Get(storyPath(dad.Id, made.Id), http.StatusOK, nil)

	// Shared per story.
	c.Patch(storyPath(dad.Id, made.Id), map[string]string{"visibility": "family"}, http.StatusBadRequest, nil)
	c.Patch(storyPath(dad.Id, made.Id), map[string]string{"visibility": "partner"}, http.StatusOK, nil)
	var got httpapi.Story
	c.Get(storyPath(mom.Id, made.Id), http.StatusOK, &got)
	if got.Title != made.Title || len(got.Pages) != len(made.Pages) {
		t.Errorf("Mom reads the shared story: %+v", got)
	}
	// Still only the author may change or delete it.
	c.Patch(storyPath(mom.Id, made.Id), map[string]string{"visibility": "private"}, http.StatusNotFound, nil)
	c.Delete(storyPath(mom.Id, made.Id), http.StatusNotFound, nil)

	// Caregivers never see stories.
	for _, cg := range fam.Caregivers {
		c.Get(storiesPath(cg.Id), http.StatusNotFound, nil)
		c.Get(storyPath(cg.Id, made.Id), http.StatusNotFound, nil)
		c.Post(storiesPath(cg.Id), storyInput(&leo, "bedtime", "private", "a walk"), http.StatusNotFound, nil)
	}

	c.Delete(storyPath(dad.Id, made.Id), http.StatusNoContent, nil)
	c.Get(storyPath(dad.Id, made.Id), http.StatusNotFound, nil)

	for _, action := range []string{"create", "read", "update", "delete"} {
		if c.AuditCount(fam.Id, action, "story") == 0 {
			t.Errorf("no %s audit for stories", action)
		}
	}
}

func TestEachParentSeesTheirOwnSeededShelf(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	moms, dads := storyTitles(c, mom.Id), storyTitles(c, dad.Id)
	if len(moms) != 2 || len(dads) != 1 {
		t.Errorf("Rachel sees both, Tom only his own: %d %d", len(moms), len(dads))
	}
	// Without childId a name or nickname works (before birth) and the story has no age.
	var made httpapi.Story
	in := storyInput(nil, "sibling", "private", "You hugged the bump and said hello, little bean")
	in["childName"] = "Ava Grace"
	in["signedAs"] = "Mama"
	c.Post(storiesPath(mom.Id), in, http.StatusCreated, &made)
	if made.ChildName != "Ava" || made.AgeMonths != nil || made.SignedAs != "Mama" || made.Theme != httpapi.Sibling {
		t.Errorf("created = %+v", made)
	}
}

const storyGood = `{"title":"Leo and the Quiet Night","pages":[
{"text":"The moon rose over Leo's room.","art":"moon"},
{"text":"Mama tucked Leo in, soft and warm.","art":"cuddle"},
{"text":"Leo held Mama's finger all night long.","art":"hearts"},
{"text":"Papa sang a silly song, and Leo listened.","art":"home"},
{"text":"The stars came out to listen too.","art":"stars"},
{"text":"Goodnight, Leo. We love you so.","art":"moon"}]}`

func TestStoryIsWrittenByClaudeFromOnlyTheChosenFacts(t *testing.T) {
	f := &fakeClaude{text: storyGood}
	c := withClaude(t, f)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	leo := fam.Children[0].Id

	var l httpapi.StoryList
	c.Get(storiesPath(mom.Id), http.StatusOK, &l)
	if !l.AiEnabled {
		t.Error("aiEnabled should be true with a key")
	}
	var made httpapi.Story
	c.Post(storiesPath(mom.Id), storyInput(&leo, "bedtime", "private",
		"You held my finger all night, see https://example.com or call 617-555-0133"), http.StatusCreated, &made)
	if made.GeneratedBy != httpapi.Ai || made.Title != "Leo and the Quiet Night" || len(made.Pages) != 6 {
		t.Fatalf("created = %+v", made)
	}
	if len(f.requests) != 1 {
		t.Fatalf("%d requests", len(f.requests))
	}
	if got := f.headers[0].Get("anthropic-beta"); got != "server-side-fallback-2026-07-01" {
		t.Errorf("fallbacks need their beta header, got %q", got)
	}
	var sent struct {
		Model        string `json:"model"`
		Fallbacks    string `json:"fallbacks"`
		OutputConfig struct {
			Effort string `json:"effort"`
		} `json:"output_config"`
		Messages []struct {
			Content string `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal([]byte(f.requests[0]), &sent); err != nil {
		t.Fatal(err)
	}
	if sent.Model != "claude-opus-5-5" || sent.OutputConfig.Effort != "low" || sent.Fallbacks != "default" || len(sent.Messages) != 1 {
		t.Errorf("request = %s", f.requests[0])
	}
	body := sent.Messages[0].Content
	if !strings.Contains(body, "You held my finger all night") || !strings.Contains(body, `"childFirstName":"Leo"`) {
		t.Errorf("the chosen facts must be sent: %s", body)
	}
	// Minimal: no links or numbers from the memory, no parent names, care team, birth date or other records.
	for _, never := range []string{"example.com", "617", "Aisha", "Marcus", "Ortiz", "Linda", "birth", "mood", "hepb"} {
		if strings.Contains(body, never) {
			t.Errorf("the prompt must not contain %q: %s", never, body)
		}
	}
	if strings.Contains(strings.Join(made.Memories, " "), "example.com") {
		t.Errorf("links are stripped from the stored memories: %v", made.Memories)
	}
}

func TestStoryFallsBackToTheTemplateOnABadAnswer(t *testing.T) {
	five := `{"title":"Leo","pages":[{"text":"Leo.","art":"moon"},{"text":"Leo.","art":"moon"},{"text":"Leo.","art":"moon"},{"text":"Leo.","art":"moon"},{"text":"Leo.","art":"moon"}]}`
	cases := map[string]*fakeClaude{
		"server error":    {status: http.StatusInternalServerError},
		"not json":        {text: "Once upon a time"},
		"too few pages":   {text: five},
		"medical words":   {text: strings.Replace(storyGood, "The stars came out", "The doctor came in", 1)},
		"unknown art":     {text: strings.Replace(storyGood, `"art":"stars"`, `"art":"dragon"`, 1)},
		"digits":          {text: strings.Replace(storyGood, "all night long", "for 9 hours", 1)},
		"no child's name": {text: strings.ReplaceAll(storyGood, "Leo", "Max")},
		"too slow":        {text: storyGood, delay: time.Second},
	}
	for name, f := range cases {
		t.Run(name, func(t *testing.T) {
			c := withClaude(t, f)
			fam := c.StartDemo("newborn")
			mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
			leo := fam.Children[0].Id
			var made httpapi.Story
			c.Post(storiesPath(mom.Id), storyInput(&leo, "bedtime", "private", "a walk in the sun"), http.StatusCreated, &made)
			if made.GeneratedBy != httpapi.Template || made.Title != "Leo and the Sleepy Moon" {
				t.Errorf("want the template story, got %+v", made)
			}
		})
	}
}

// A reply cut off at max_tokens or refused is not used, even if its text parses.
func TestStoryIgnoresAnUnfinishedAnswer(t *testing.T) {
	for _, stop := range []string{"max_tokens", "refusal"} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{"stop_reason": stop, "content": []map[string]any{{"type": "text", "text": storyGood}}})
		}))
		c := testutil.NewWithConfig(t, httpapi.Config{AI: ai.Config{APIKey: ai.Secret("test-key"), BaseURL: srv.URL, Timeout: 500 * time.Millisecond}})
		fam := c.StartDemo("newborn")
		mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
		leo := fam.Children[0].Id
		var made httpapi.Story
		c.Post(storiesPath(mom.Id), storyInput(&leo, "bedtime", "private", "a walk in the sun"), http.StatusCreated, &made)
		if made.GeneratedBy != httpapi.Template {
			t.Errorf("%s: want the template, got %s", stop, made.GeneratedBy)
		}
		srv.Close()
	}
}
