package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func offerBody() map[string]any {
	return map[string]any{
		"partnerName": "Acorn Baby", "title": "Free swaddle", "detail": "A free swaddle with any order.",
		"url": "https://example.com/acorn", "stages": []string{"pregnancy"}, "audience": []string{"mother", "partner"}, "active": true,
	}
}

func TestAdminOffersListCreateAndEdit(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get("/api/admin/partner-offers", http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)

	var all httpapi.PartnerOfferList
	c.Get("/api/admin/partner-offers", http.StatusOK, &all)
	if len(all.Items) != 5 || all.Items[0].Clicks == nil || *all.Items[0].Clicks != 0 {
		t.Fatalf("every offer of this copy with click counts: %+v", all.Items)
	}
	if all.Items[0].PartnerName != "Seedling Preschool Finder" { // newest first
		t.Errorf("newest first, got %q first", all.Items[0].PartnerName)
	}
	// Clicks are counted per offer.
	var shown httpapi.PartnerOfferList
	c.Get(offersPath(mom.Id), http.StatusOK, &shown)
	c.Post(offersPath(mom.Id)+"/"+shown.Items[0].Id.String()+"/clicks", nil, http.StatusNoContent, nil)
	c.Get("/api/admin/partner-offers", http.StatusOK, &all)
	for _, o := range all.Items {
		want := 0
		if o.Id == shown.Items[0].Id {
			want = 1
		}
		if *o.Clicks != want {
			t.Errorf("%s clicks = %d, want %d", o.PartnerName, *o.Clicks, want)
		}
	}

	// A new active offer shows up for matching stages and roles.
	var made httpapi.PartnerOffer
	c.Post("/api/admin/partner-offers", offerBody(), http.StatusCreated, &made)
	if made.Clicks == nil || *made.Clicks != 0 || !made.Active || made.PartnerName != "Acorn Baby" {
		t.Errorf("created = %+v", made)
	}
	c.Get("/api/admin/partner-offers", http.StatusOK, &all)
	if len(all.Items) != 6 || all.Items[0].Id != made.Id {
		t.Errorf("the new offer comes first: %+v", all.Items[0])
	}
	// Edit only what is sent; switching it off hides it from the parent.
	var edited httpapi.PartnerOffer
	c.Patch("/api/admin/partner-offers/"+made.Id.String(), map[string]any{"title": "Free swaddle and book", "active": false}, http.StatusOK, &edited)
	if edited.Title != "Free swaddle and book" || edited.Active || edited.PartnerName != "Acorn Baby" || edited.Url != "https://example.com/acorn" {
		t.Errorf("edited = %+v", edited)
	}
	for _, n := range offerNames(c, mom.Id) {
		if n == "Acorn Baby" {
			t.Error("a switched-off offer must not be shown")
		}
	}
	c.Patch("/api/admin/partner-offers/"+made.Id.String(), map[string]any{"stages": []string{"infant"}, "active": true}, http.StatusOK, &edited)
	if len(edited.Stages) != 1 || edited.Stages[0] != httpapi.Stage("infant") || !edited.Active {
		t.Errorf("stages = %+v", edited.Stages)
	}
}

func TestAdminOffersValidationAndScope(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")
	bad := func(mod func(map[string]any)) {
		t.Helper()
		b := offerBody()
		mod(b)
		c.Post("/api/admin/partner-offers", b, http.StatusBadRequest, nil)
	}
	bad(func(b map[string]any) { b["url"] = "http://example.com" })
	bad(func(b map[string]any) { b["stages"] = []string{} })
	bad(func(b map[string]any) { b["stages"] = []string{"pregnancy", "pregnancy"} })
	bad(func(b map[string]any) { b["audience"] = []string{"grandparent"} })
	bad(func(b map[string]any) { b["title"] = "" })
	bad(func(b map[string]any) { delete(b, "active") })
	c.Patch("/api/admin/partner-offers/"+uuid.NewString(), map[string]any{}, http.StatusBadRequest, nil) // nothing to change
	c.Patch("/api/admin/partner-offers/"+uuid.NewString(), map[string]any{"title": "x"}, http.StatusNotFound, nil)

	// Another visitor's sandbox is untouched.
	var mine httpapi.PartnerOffer
	c.Post("/api/admin/partner-offers", offerBody(), http.StatusCreated, &mine)
	c.StartDemo("pregnancy")
	c.Patch("/api/admin/partner-offers/"+mine.Id.String(), map[string]any{"title": "Hijacked"}, http.StatusNotFound, nil)
	var theirs httpapi.PartnerOfferList
	c.Get("/api/admin/partner-offers", http.StatusOK, &theirs)
	if len(theirs.Items) != 5 {
		t.Errorf("another family's offers must not appear: %d", len(theirs.Items))
	}
}
