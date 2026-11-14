package httpapi_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func findGuide(t *testing.T, l httpapi.GuideList, id string) httpapi.Guide {
	t.Helper()
	for _, g := range l.Items {
		if g.Id == id {
			return g
		}
	}
	t.Fatalf("guide %s not in the list", id)
	return httpapi.Guide{}
}

func TestContentItemsListTheCatalog(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")

	var weeks, guides, questions httpapi.ContentItemList
	c.Get("/api/admin/content-items?kind=pregnancy_week", http.StatusOK, &weeks)
	c.Get("/api/admin/content-items?kind=guide", http.StatusOK, &guides)
	c.Get("/api/admin/content-items?kind=simulator_question", http.StatusOK, &questions)
	if len(weeks.Items) != 37 || weeks.Items[0].Id != "week-4" || weeks.Items[36].Id != "week-40" {
		t.Errorf("weekly cards: %d items, want week-4 to week-40", len(weeks.Items))
	}
	if len(guides.Items) == 0 || len(questions.Items) != 5 {
		t.Errorf("guides %d, practice questions %d", len(guides.Items), len(questions.Items))
	}
	for _, it := range append(weeks.Items, guides.Items...) {
		if it.Edited || it.Title == "" || it.Body == "" || it.Source == nil {
			t.Errorf("catalog item %+v", it)
		}
	}
	c.Get("/api/admin/content-items?kind=lesson", http.StatusBadRequest, nil)
}

func TestEditedGuideShowsToTheFamily(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	guides := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String() + "/guides"
	const id = "preg-warning-signs"

	var before httpapi.GuideList
	c.Get(guides, http.StatusOK, &before)
	orig := findGuide(t, before, id)

	var edited httpapi.ContentItem
	c.Patch("/api/admin/content-items/guide/"+id, map[string]any{"title": "Warning signs to save today"}, http.StatusOK, &edited)
	if !edited.Edited || edited.Title != "Warning signs to save today" || edited.Body != orig.Summary || edited.UpdatedAt == nil {
		t.Errorf("edited item = %+v", edited)
	}
	c.Patch("/api/admin/content-items/guide/"+id, map[string]any{"body": "Read these with your partner."}, http.StatusOK, &edited)
	if edited.Title != "Warning signs to save today" || edited.Body != "Read these with your partner." {
		t.Errorf("a body edit must keep the earlier title edit: %+v", edited)
	}

	var after httpapi.GuideList
	c.Get(guides, http.StatusOK, &after)
	g := findGuide(t, after, id)
	if g.Title != "Warning signs to save today" || g.Summary != "Read these with your partner." {
		t.Errorf("family sees %q / %q", g.Title, g.Summary)
	}
	if g.Source != orig.Source || !slices.Equal(g.Steps, orig.Steps) {
		t.Errorf("source and steps must stay the catalog's")
	}

	var list httpapi.ContentItemList
	c.Get("/api/admin/content-items?kind=guide", http.StatusOK, &list)
	if !slices.ContainsFunc(list.Items, func(it httpapi.ContentItem) bool { return it.Id == id && it.Edited }) {
		t.Errorf("admin list does not mark %s as edited", id)
	}

	var reset httpapi.ContentItem
	c.Post("/api/admin/content-items/guide/"+id+"/reset", nil, http.StatusOK, &reset)
	if reset.Edited || reset.Title != orig.Title || reset.Body != orig.Summary || reset.UpdatedAt != nil {
		t.Errorf("reset item = %+v", reset)
	}
	c.Get(guides, http.StatusOK, &after)
	if g := findGuide(t, after, id); g.Title != orig.Title || g.Summary != orig.Summary {
		t.Errorf("after reset the family sees %q / %q", g.Title, g.Summary)
	}
}

func TestEditedWeekCardShowsToTheFamily(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	week := func(p httpapi.Parent, n string) httpapi.PregnancyWeek {
		var w httpapi.PregnancyWeek
		c.Get("/api/members/"+p.Id.String()+"/pregnancy-weeks/"+n, http.StatusOK, &w)
		return w
	}
	orig := week(mom, "25")

	c.Patch("/api/admin/content-items/pregnancy_week/week-25", map[string]any{"body": "Your baby can now hear your voice."}, http.StatusOK, nil)
	for _, p := range []httpapi.Parent{mom, partner} {
		if w := week(p, "25"); w.WhyItMatters != "Your baby can now hear your voice." || w.Source != orig.Source {
			t.Errorf("%s sees %q (source %v)", p.Role, w.WhyItMatters, w.Source)
		}
	}
	if w := week(mom, "26"); w.WhyItMatters == "Your baby can now hear your voice." {
		t.Errorf("the edit leaked into week 26")
	}

	// Birth prep modules on the card are guides and take guide edits.
	c.Patch("/api/admin/content-items/guide/birth-prep-leave", map[string]any{"title": "Leave: check it this week"}, http.StatusOK, nil)
	w := week(mom, "30")
	if !slices.ContainsFunc(w.BirthPrep, func(g httpapi.Guide) bool { return g.Title == "Leave: check it this week" }) {
		t.Errorf("week 30 birth prep does not show the edited module")
	}
}

func TestContentEditsStayInTheirFamily(t *testing.T) {
	other := testutil.New(t)
	other.StartDemo("pregnancy")
	other.Patch("/api/admin/content-items/guide/preg-warning-signs", map[string]any{"title": "Only for the other visitor"}, http.StatusOK, nil)

	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	var l httpapi.GuideList
	c.Get("/api/members/"+mom.Id.String()+"/guides", http.StatusOK, &l)
	if g := findGuide(t, l, "preg-warning-signs"); strings.Contains(g.Title, "other visitor") {
		t.Errorf("another visitor's edit shows in this family")
	}
	var items httpapi.ContentItemList
	c.Get("/api/admin/content-items?kind=guide", http.StatusOK, &items)
	for _, it := range items.Items {
		if it.Edited {
			t.Errorf("%s is marked edited in a fresh family", it.Id)
		}
	}
}

func TestContentAdminErrors(t *testing.T) {
	anon := testutil.New(t)
	anon.Get("/api/admin/content-items?kind=guide", http.StatusUnauthorized, nil)
	anon.Patch("/api/admin/content-items/guide/preg-gbs", map[string]any{"title": "x"}, http.StatusUnauthorized, nil)
	anon.Post("/api/admin/content-items/guide/preg-gbs/reset", nil, http.StatusUnauthorized, nil)

	c := testutil.New(t)
	c.StartDemo("pregnancy")
	c.Patch("/api/admin/content-items/guide/no-such-guide", map[string]any{"title": "x"}, http.StatusNotFound, nil)
	c.Patch("/api/admin/content-items/pregnancy_week/week-41", map[string]any{"body": "x"}, http.StatusNotFound, nil)
	c.Patch("/api/admin/content-items/simulator_question/first-night-home-q2", map[string]any{"body": "x"}, http.StatusNotFound, nil)
	c.Post("/api/admin/content-items/guide/no-such-guide/reset", nil, http.StatusNotFound, nil)
	c.Patch("/api/admin/content-items/guide/preg-gbs", map[string]any{}, http.StatusBadRequest, nil)
	c.Patch("/api/admin/content-items/guide/preg-gbs", map[string]any{"title": ""}, http.StatusBadRequest, nil)
}
