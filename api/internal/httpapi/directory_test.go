package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func providers(t *testing.T, c *testutil.Client, query string) []httpapi.Provider {
	t.Helper()
	var l httpapi.ProviderList
	c.Get("/api/providers"+query, http.StatusOK, &l)
	return l.Items
}

func TestProvidersNeedASession(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/providers", http.StatusUnauthorized, nil)
}

func TestProvidersFilterAndSort(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")

	all := providers(t, c, "")
	types := map[httpapi.ProviderType]bool{}
	for i, p := range all {
		types[p.Type] = true
		if i > 0 && p.NextAvailable.Before(all[i-1].NextAvailable.Time) {
			t.Errorf("providers not sorted soonest first: %s before %s", all[i-1].NextAvailable, p.NextAvailable)
		}
		if p.NextAvailable.Before(testutil.Now.Truncate(24 * time.Hour)) {
			t.Errorf("%s next available %s is in the past", p.Name, p.NextAvailable)
		}
	}
	if len(types) != 7 {
		t.Errorf("directory covers %d provider types, want all 7", len(types))
	}

	tx := providers(t, c, "?type=perinatal_therapist&state=TX")
	if len(tx) == 0 {
		t.Fatal("no perinatal therapist in TX for the demo family")
	}
	for _, p := range tx {
		if p.Type != httpapi.ProviderType("perinatal_therapist") || p.State != "TX" {
			t.Errorf("filter leaked %s (%s, %s)", p.Name, p.Type, p.State)
		}
	}
	if n := len(providers(t, c, "?state=TX")); n <= len(tx) || n >= len(all) {
		t.Errorf("state filter alone returned %d of %d providers", n, len(all))
	}
}

func TestProvidersValidation(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")
	c.Get("/api/providers?state=Texas", http.StatusBadRequest, nil)
	c.Get("/api/providers?state=tx", http.StatusBadRequest, nil)
	c.Get("/api/providers?type=astrologer", http.StatusBadRequest, nil)
}

func TestProvidersAreTheSameForEverySession(t *testing.T) {
	a, b := testutil.New(t), testutil.New(t)
	a.StartDemo("pregnancy")
	b.StartDemo("pregnancy")
	pa, pb := providers(t, a, ""), providers(t, b, "")
	if len(pa) != len(pb) {
		t.Fatalf("sessions see %d and %d providers", len(pa), len(pb))
	}
	for i := range pa {
		if pa[i].Id != pb[i].Id {
			t.Errorf("provider %d differs between sessions: %s vs %s", i, pa[i].Name, pb[i].Name)
		}
	}
}

func TestBookingRequestFlow(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/booking-requests"
	p := providers(t, c, "?type=perinatal_therapist&state=TX")[0]

	note := "Evenings work best."
	var created httpapi.BookingRequest
	c.Post(path, httpapi.BookingRequestInput{ProviderId: p.Id, Note: &note}, http.StatusCreated, &created)
	if created.Status != httpapi.BookingRequestStatus("requested") || created.MemberId != mom.Id || created.ProviderId != p.Id {
		t.Errorf("created = %+v", created)
	}

	var list httpapi.BookingRequestList
	c.Get(path, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].Id != created.Id || list.Items[0].Status != "requested" {
		t.Errorf("list = %+v, want the one requested booking", list.Items)
	}

	c.Post(path, httpapi.BookingRequestInput{ProviderId: p.Id}, http.StatusConflict, nil)
}

func TestBookingRequestValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/booking-requests"

	c.Post(path, map[string]any{}, http.StatusBadRequest, nil)
	c.Post(path, map[string]any{"providerId": "not-a-uuid"}, http.StatusBadRequest, nil)
	// Unknown provider: the contract declares 400 for bad input; 404 is for the member in the path.
	c.Post(path, map[string]any{"providerId": "00000000-0000-0000-0000-000000000000"}, http.StatusBadRequest, nil)
}

func TestBookingRequestPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	p := providers(t, c, "?type=psychologist")[0]
	c.Post("/api/members/"+mom.Id.String()+"/booking-requests", httpapi.BookingRequestInput{ProviderId: p.Id}, http.StatusCreated, nil)

	var seenByPartner httpapi.BookingRequestList
	c.Get("/api/members/"+partner.Id.String()+"/booking-requests", http.StatusOK, &seenByPartner)
	if len(seenByPartner.Items) != 0 {
		t.Errorf("partner must never see mom's booking request, got %+v", seenByPartner.Items)
	}
	// The partner can ask the same provider separately.
	c.Post("/api/members/"+partner.Id.String()+"/booking-requests", httpapi.BookingRequestInput{ProviderId: p.Id}, http.StatusCreated, nil)

	other := testutil.New(t)
	other.StartDemo("pregnancy")
	other.Get("/api/members/"+mom.Id.String()+"/booking-requests", http.StatusNotFound, nil)
	other.Post("/api/members/"+mom.Id.String()+"/booking-requests", httpapi.BookingRequestInput{ProviderId: p.Id}, http.StatusNotFound, nil)
}

func TestBookingRequestIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/booking-requests"

	c.Post(path, httpapi.BookingRequestInput{ProviderId: providers(t, c, "")[0].Id}, http.StatusCreated, nil)
	c.Get(path, http.StatusOK, nil)
	if n := c.AuditCount(fam.Id, "create", "booking_request"); n != 1 {
		t.Errorf("create audit rows = %d, want 1", n)
	}
	if n := c.AuditCount(fam.Id, "read", "booking_request"); n != 1 {
		t.Errorf("read audit rows = %d, want 1", n)
	}
}
