package httpapi_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func offersPath(p httpapi.Parent) string { return "/api/members/" + p.Id.String() + "/partner-offers" }

func newOffer(title string, stages []string, audience []string, active bool) map[string]any {
	return map[string]any{
		"partnerName": "Nestwell", "title": title, "detail": "For families in their third trimester.",
		"url": "https://example.com/offer", "stages": stages, "audience": audience, "active": active,
	}
}

func titles(l httpapi.PartnerOfferList) []string {
	out := []string{}
	for _, o := range l.Items {
		out = append(out, o.Title)
	}
	return out
}

func TestPartnerOffersMatchStageAndRole(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var seen httpapi.PartnerOfferList
	c.Get(offersPath(mom), http.StatusOK, &seen)
	if len(seen.Items) == 0 || len(seen.Items) > 3 {
		t.Fatalf("mother sees %d offers, want 1 to 3", len(seen.Items))
	}
	for _, o := range seen.Items {
		if !slices.Contains(o.Stages, httpapi.StagePregnancy) || !slices.Contains(o.Audience, httpapi.ParentRoleMother) || !o.Active {
			t.Errorf("mother sees an offer for %v / %v (active %v)", o.Stages, o.Audience, o.Active)
		}
		if o.Clicks != nil {
			t.Errorf("parents must not see click counts")
		}
	}

	// Start from no offers so the targeting is the only thing under test.
	var all httpapi.PartnerOfferList
	c.Get("/api/admin/partner-offers", http.StatusOK, &all)
	for _, o := range all.Items {
		c.Patch("/api/admin/partner-offers/"+o.Id.String(), map[string]any{"active": false}, http.StatusOK, nil)
	}
	c.Post("/api/admin/partner-offers", newOffer("Pregnancy, both", []string{"pregnancy"}, []string{"mother", "partner"}, true), http.StatusCreated, nil)
	c.Post("/api/admin/partner-offers", newOffer("Pregnancy, partner", []string{"pregnancy"}, []string{"partner"}, true), http.StatusCreated, nil)
	c.Post("/api/admin/partner-offers", newOffer("Preschool", []string{"preschool"}, []string{"mother", "partner"}, true), http.StatusCreated, nil)
	c.Post("/api/admin/partner-offers", newOffer("Switched off", []string{"pregnancy"}, []string{"mother", "partner"}, false), http.StatusCreated, nil)

	var forMom, forPartner httpapi.PartnerOfferList
	c.Get(offersPath(mom), http.StatusOK, &forMom)
	c.Get(offersPath(partner), http.StatusOK, &forPartner)
	if got := titles(forMom); !slices.Equal(got, []string{"Pregnancy, both"}) {
		t.Errorf("mother sees %v", got)
	}
	if got := titles(forPartner); len(got) != 2 || !slices.Contains(got, "Pregnancy, partner") || !slices.Contains(got, "Pregnancy, both") {
		t.Errorf("partner sees %v", got)
	}

	// Never more than three.
	for _, title := range []string{"A", "B", "C"} {
		c.Post("/api/admin/partner-offers", newOffer(title, []string{"pregnancy"}, []string{"mother"}, true), http.StatusCreated, nil)
	}
	c.Get(offersPath(mom), http.StatusOK, &forMom)
	if len(forMom.Items) != 3 {
		t.Errorf("mother sees %d offers, want at most 3", len(forMom.Items))
	}
}

func TestEveryDemoFamilyHasPartnerOffers(t *testing.T) {
	c := testutil.New(t)
	for _, tmpl := range []string{"planning", "pregnancy", "newborn", "preschool"} {
		fam := c.StartDemo(tmpl)
		for _, p := range fam.Parents {
			var l httpapi.PartnerOfferList
			c.Get(offersPath(p), http.StatusOK, &l)
			if len(l.Items) == 0 {
				t.Errorf("%s: %s sees no partner offers", tmpl, p.Role)
			}
		}
	}
}

func TestPartnerOfferClicksAreCounted(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var shown httpapi.PartnerOfferList
	c.Get(offersPath(mom), http.StatusOK, &shown)
	offer := shown.Items[0]
	c.Post(offersPath(mom)+"/"+offer.Id.String()+"/clicks", nil, http.StatusNoContent, nil)
	c.Post(offersPath(partner)+"/"+offer.Id.String()+"/clicks", nil, http.StatusNoContent, nil)

	var all httpapi.PartnerOfferList
	c.Get("/api/admin/partner-offers", http.StatusOK, &all)
	for _, o := range all.Items {
		want := 0
		if o.Id == offer.Id {
			want = 2
		}
		if o.Clicks == nil || *o.Clicks != want {
			t.Errorf("%s: clicks = %v, want %d", o.Title, o.Clicks, want)
		}
	}

	// Only the offer, the family and the time are stored.
	var cols []string
	rows, err := c.Pool.Query(t.Context(), `SELECT column_name FROM information_schema.columns WHERE table_name = 'partner_offer_clicks' ORDER BY column_name`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		cols = append(cols, s)
	}
	if !slices.Equal(cols, []string{"clicked_at", "family_id", "id", "offer_id"}) {
		t.Errorf("partner_offer_clicks columns = %v; a click must not record who clicked", cols)
	}
}

func TestPartnerOffersStayInTheirFamily(t *testing.T) {
	other := testutil.New(t)
	other.StartDemo("pregnancy")
	var theirs httpapi.PartnerOffer
	other.Post("/api/admin/partner-offers", newOffer("Only for the other visitor", []string{"pregnancy"}, []string{"mother", "partner"}, true), http.StatusCreated, &theirs)

	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c.Post(offersPath(mom)+"/"+theirs.Id.String()+"/clicks", nil, http.StatusNotFound, nil)
	c.Patch("/api/admin/partner-offers/"+theirs.Id.String(), map[string]any{"active": false}, http.StatusNotFound, nil)

	var mine httpapi.PartnerOfferList
	c.Get("/api/admin/partner-offers", http.StatusOK, &mine)
	c.Get(offersPath(mom), http.StatusOK, nil)
	if slices.Contains(titles(mine), theirs.Title) {
		t.Errorf("another visitor's offer shows up in this family's admin")
	}
	c.Post(offersPath(mom)+"/00000000-0000-4000-8000-000000000001/clicks", nil, http.StatusNotFound, nil)
}

func TestAdminPartnerOffers(t *testing.T) {
	anon := testutil.New(t)
	anon.Get("/api/admin/partner-offers", http.StatusUnauthorized, nil)
	anon.Post("/api/admin/partner-offers", newOffer("x", []string{"pregnancy"}, []string{"mother"}, true), http.StatusUnauthorized, nil)
	anon.Patch("/api/admin/partner-offers/00000000-0000-4000-8000-000000000001", map[string]any{"active": false}, http.StatusUnauthorized, nil)

	c := testutil.New(t)
	c.StartDemo("pregnancy")
	bad := newOffer("Plain http", []string{"pregnancy"}, []string{"mother"}, true)
	bad["url"] = "http://example.com"
	c.Post("/api/admin/partner-offers", bad, http.StatusBadRequest, nil)
	c.Patch("/api/admin/partner-offers/00000000-0000-4000-8000-000000000001", map[string]any{}, http.StatusBadRequest, nil)

	var created, updated httpapi.PartnerOffer
	c.Post("/api/admin/partner-offers", newOffer("Car seat", []string{"pregnancy"}, []string{"mother", "partner"}, true), http.StatusCreated, &created)
	if created.Clicks == nil || *created.Clicks != 0 {
		t.Errorf("new offer clicks = %v, want 0", created.Clicks)
	}
	c.Patch("/api/admin/partner-offers/"+created.Id.String(), map[string]any{"title": "Car seat, 25% off", "stages": []string{"postpartum", "infant"}}, http.StatusOK, &updated)
	if updated.Title != "Car seat, 25% off" || updated.Detail != created.Detail || updated.Active != true ||
		!slices.Equal(updated.Stages, []httpapi.Stage{httpapi.StagePostpartum, httpapi.StageInfant}) {
		t.Errorf("updated offer = %+v", updated)
	}

	var all httpapi.PartnerOfferList
	c.Get("/api/admin/partner-offers", http.StatusOK, &all)
	if all.Items[0].Id != created.Id {
		t.Errorf("admin list is not newest first: %v", titles(all))
	}
	if !slices.ContainsFunc(all.Items, func(o httpapi.PartnerOffer) bool { return !o.Active }) {
		t.Errorf("admin list must include offers that are switched off")
	}
}
