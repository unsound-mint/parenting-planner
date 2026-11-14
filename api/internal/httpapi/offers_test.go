package httpapi_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func offersPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/partner-offers" }

func offerNames(c *testutil.Client, id uuid.UUID) []string {
	var l httpapi.PartnerOfferList
	c.Get(offersPath(id), http.StatusOK, &l)
	out := []string{}
	for _, o := range l.Items {
		out = append(out, o.PartnerName)
	}
	return out
}

func TestOffersMatchStageAndRoleOnly(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get(offersPath(uuid.New()), http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	// The doula offer is for mothers; the class and the meals are for both parents.
	if got := offerNames(c, mom.Id); len(got) != 3 || got[0] != "Cradle & Co" || got[1] != "Nightingale Doulas" {
		t.Errorf("mom's offers = %v", got)
	}
	if got := offerNames(c, jake.Id); len(got) != 2 || got[0] != "Cradle & Co" || got[1] != "Little Sprout Meals" {
		t.Errorf("Jake's offers = %v", got)
	}
	var l httpapi.PartnerOfferList
	c.Get(offersPath(mom.Id), http.StatusOK, &l)
	for _, o := range l.Items {
		if !o.Active || o.Url == "" || len(o.Stages) == 0 || len(o.Audience) == 0 || o.Clicks != nil {
			t.Errorf("offer = %+v", o)
		}
	}
	for _, st := range []struct{ template, want string }{{"newborn", "Nightingale Doulas"}, {"preschool", "Seedling Preschool Finder"}} {
		other := c.StartDemo(st.template)
		m := testutil.Parent(t, other, httpapi.ParentRoleMother)
		if got := offerNames(c, m.Id); len(got) == 0 || got[len(got)-1] != st.want && got[0] != st.want {
			t.Errorf("%s offers = %v", st.template, got)
		}
	}
	// Planning has no offers in the seed.
	pl := c.StartDemo("planning")
	if got := offerNames(c, testutil.Parent(t, pl, httpapi.ParentRoleMother).Id); len(got) != 0 {
		t.Errorf("planning offers = %v", got)
	}
}

func TestOffersAreCappedAtThreeAndInactiveOnesAreHidden(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	for i := 0; i < 3; i++ {
		if _, err := c.Pool.Exec(context.Background(), `INSERT INTO partner_offers (family_id, partner_name, title, detail, url, stages, audience)
			VALUES ($1, 'Extra', 't', 'd', 'https://example.com', '{pregnancy}', '{mother,partner}')`, fam.Id); err != nil {
			t.Fatal(err)
		}
	}
	if got := offerNames(c, mom.Id); len(got) != 3 {
		t.Errorf("at most 3 offers, got %v", got)
	}
	if _, err := c.Pool.Exec(context.Background(), `UPDATE partner_offers SET active = false WHERE family_id = $1 AND partner_name = 'Cradle & Co'`, fam.Id); err != nil {
		t.Fatal(err)
	}
	for _, n := range offerNames(c, mom.Id) {
		if n == "Cradle & Co" {
			t.Error("an inactive offer must not be shown")
		}
	}
}

func TestNoOffersWhileInPregnancyLossSupport(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	if len(offerNames(c, mom.Id)) == 0 {
		t.Fatal("setup: a pregnant family has offers")
	}
	c.Post(lossPath(mom.Id), map[string]any{}, http.StatusCreated, nil)
	if got := offerNames(c, mom.Id); len(got) != 0 {
		t.Errorf("no offers during support: %v", got)
	}
	c.Delete(lossPath(mom.Id), http.StatusOK, nil)
	if len(offerNames(c, mom.Id)) == 0 {
		t.Error("offers return when support is undone")
	}
}

func TestOfferClicksAreCountedAndScoped(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, first, httpapi.ParentRoleMother)
	var l httpapi.PartnerOfferList
	c.Get(offersPath(mom.Id), http.StatusOK, &l)
	offer := l.Items[0].Id

	c.Post(offersPath(mom.Id)+"/"+offer.String()+"/clicks", nil, http.StatusNoContent, nil)
	c.Post(offersPath(mom.Id)+"/"+offer.String()+"/clicks", nil, http.StatusNoContent, nil)
	var n int
	if err := c.Pool.QueryRow(context.Background(), `SELECT count(*) FROM partner_offer_clicks WHERE offer_id = $1 AND family_id = $2`, offer, first.Id).Scan(&n); err != nil || n != 2 {
		t.Errorf("clicks = %d, %v", n, err)
	}
	c.Post(offersPath(mom.Id)+"/"+uuid.NewString()+"/clicks", nil, http.StatusNotFound, nil)

	second := c.StartDemo("pregnancy") // the client now holds another family's session
	momB := testutil.Parent(t, second, httpapi.ParentRoleMother)
	c.Post(offersPath(momB.Id)+"/"+offer.String()+"/clicks", nil, http.StatusNotFound, nil) // another family's offer
	c.Post(offersPath(mom.Id)+"/"+offer.String()+"/clicks", nil, http.StatusNotFound, nil)  // another family's parent
	for _, cg := range second.Caregivers {
		c.Get(offersPath(cg.Id), http.StatusNotFound, nil)
	}
}
