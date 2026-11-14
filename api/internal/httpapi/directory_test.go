package httpapi_test

import (
	"net/http"
	"strings"
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

func TestProvidersFilter(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")

	all := providers(t, c, "")
	types := map[httpapi.ProviderType]bool{}
	for _, p := range all {
		types[p.Type] = true
		if p.Bio == "" || p.Credentials == "" || len(p.VisitModes) == 0 || p.SessionMinutes == 0 {
			t.Errorf("%s has no profile: %+v", p.Name, p)
		}
		if strings.Contains(p.Name, "demo") || strings.Contains(p.Summary, "Demo") {
			t.Errorf("%s repeats the demo label the page says once", p.Name)
		}
	}
	if len(types) != 9 {
		t.Errorf("directory covers %d provider types, want all 9", len(types))
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

func slotsPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/provider-slots" }
func bookingsPath(m httpapi.Parent) string {
	return "/api/members/" + m.Id.String() + "/provider-bookings"
}

func openSlots(t *testing.T, c *testutil.Client, m httpapi.Parent, providerID string) []httpapi.ProviderSlot {
	t.Helper()
	var l httpapi.ProviderSlotList
	q := ""
	if providerID != "" {
		q = "?providerId=" + providerID
	}
	c.Get(slotsPath(m)+q, http.StatusOK, &l)
	return l.Items
}

func hasSlot(slots []httpapi.ProviderSlot, id string) bool {
	for _, s := range slots {
		if s.Id.String() == id {
			return true
		}
	}
	return false
}

func TestProviderSlotsAreRealAndInTheWindow(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	all := openSlots(t, c, mom, "")
	if len(all) < 50 {
		t.Fatalf("only %d open times in two weeks", len(all))
	}
	withTimes := map[string]bool{}
	for i, s := range all {
		withTimes[s.ProviderId.String()] = true
		if !s.StartsAt.After(testutil.Now) || s.StartsAt.After(testutil.Now.Add(14*24*time.Hour)) {
			t.Errorf("slot %s is outside the next 14 days", s.StartsAt)
		}
		if i > 0 && s.StartsAt.Before(all[i-1].StartsAt) {
			t.Errorf("slots not soonest first")
		}
	}
	if n := len(providers(t, c, "")); len(withTimes) != n {
		t.Errorf("%d of %d providers have open times", len(withTimes), n)
	}
	p := providers(t, c, "?type=doula&state=TX")[0]
	for _, s := range openSlots(t, c, mom, p.Id.String()) {
		if s.ProviderId != p.Id {
			t.Errorf("providerId filter leaked %s", s.ProviderId)
		}
	}
	// The same family reads the same times again: the fill does not repeat.
	if again := openSlots(t, c, mom, ""); len(again) != len(all) {
		t.Errorf("second read has %d slots, first %d", len(again), len(all))
	}
}

func TestProviderBookingFlow(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	p := providers(t, c, "?type=perinatal_therapist&state=TX")[0]
	slots := openSlots(t, c, mom, p.Id.String())
	if len(slots) < 2 {
		t.Fatalf("%s has %d open times", p.Name, len(slots))
	}

	note := "Sleep and worry."
	var b httpapi.ProviderBooking
	c.Post(bookingsPath(mom), httpapi.ProviderBookingInput{SlotId: slots[0].Id, Visibility: "private", Note: &note}, http.StatusCreated, &b)
	if b.ProviderId != p.Id || b.ProviderName != p.Name || !b.StartsAt.Equal(slots[0].StartsAt) || b.MemberId != mom.Id || b.Note == nil || *b.Note != note {
		t.Errorf("booking = %+v", b)
	}
	if hasSlot(openSlots(t, c, mom, p.Id.String()), slots[0].Id.String()) {
		t.Error("a booked time is still open")
	}
	c.Post(bookingsPath(mom), httpapi.ProviderBookingInput{SlotId: slots[0].Id, Visibility: "private"}, http.StatusConflict, nil)

	// Reschedule to the next time: the old one opens again.
	one := bookingsPath(mom) + "/" + b.Id.String()
	var moved httpapi.ProviderBooking
	c.Patch(one, map[string]any{"slotId": slots[1].Id}, http.StatusOK, &moved)
	if !moved.StartsAt.Equal(slots[1].StartsAt) || moved.Note == nil {
		t.Errorf("moved = %+v", moved)
	}
	open := openSlots(t, c, mom, p.Id.String())
	if !hasSlot(open, slots[0].Id.String()) || hasSlot(open, slots[1].Id.String()) {
		t.Error("reschedule did not swap the open times")
	}
	// Another provider's time is not a reschedule.
	other := openSlots(t, c, mom, providers(t, c, "?type=doula&state=TX")[0].Id.String())[0]
	c.Patch(one, map[string]any{"slotId": other.Id}, http.StatusConflict, nil)
	var edited httpapi.ProviderBooking
	c.Patch(one, map[string]any{"visibility": "family", "note": ""}, http.StatusOK, &edited)
	if edited.Visibility != "family" || edited.Note != nil {
		t.Errorf("edit = %+v", edited)
	}

	var list httpapi.ProviderBookingList
	c.Get(bookingsPath(mom), http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].Id != b.Id {
		t.Errorf("list = %+v", list.Items)
	}

	var cal httpapi.CalendarEventList
	c.Get("/api/members/"+mom.Id.String()+"/calendar-events?scope=mine", http.StatusOK, &cal)
	found := false
	for _, e := range cal.Items {
		found = found || (e.Kind == httpapi.CalendarEventKindProviderVisit && e.StartsAt.Equal(slots[1].StartsAt))
	}
	if !found {
		t.Error("the visit is not on the calendar")
	}

	c.Delete(one, http.StatusNoContent, nil)
	c.Delete(one, http.StatusNotFound, nil)
	if !hasSlot(openSlots(t, c, mom, p.Id.String()), slots[1].Id.String()) {
		t.Error("a cancelled time did not open again")
	}
	c.Get(bookingsPath(mom), http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Errorf("list after cancel = %+v", list.Items)
	}
}

func TestProviderBookingValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	slot := openSlots(t, c, mom, "")[0]
	c.Post(bookingsPath(mom), map[string]any{}, http.StatusBadRequest, nil)
	c.Post(bookingsPath(mom), map[string]any{"slotId": "not-a-uuid", "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(bookingsPath(mom), map[string]any{"slotId": slot.Id, "visibility": "everyone"}, http.StatusBadRequest, nil)
	c.Post(bookingsPath(mom), map[string]any{"slotId": slot.Id}, http.StatusBadRequest, nil)
	c.Post(bookingsPath(mom), map[string]any{"slotId": "00000000-0000-4000-8000-000000000000", "visibility": "private"}, http.StatusConflict, nil)
	c.Patch(bookingsPath(mom)+"/00000000-0000-4000-8000-000000000000", map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
}

func TestProviderBookingPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	p := providers(t, c, "?type=perinatal_therapist&state=TX")[0]
	slots := openSlots(t, c, mom, p.Id.String())

	var private, shared httpapi.ProviderBooking
	c.Post(bookingsPath(mom), httpapi.ProviderBookingInput{SlotId: slots[0].Id, Visibility: "private"}, http.StatusCreated, &private)
	c.Post(bookingsPath(mom), httpapi.ProviderBookingInput{SlotId: slots[1].Id, Visibility: "family"}, http.StatusCreated, &shared)

	var seen httpapi.ProviderBookingList
	c.Get(bookingsPath(partner), http.StatusOK, &seen)
	if len(seen.Items) != 1 || seen.Items[0].Id != shared.Id {
		t.Errorf("partner sees %+v, want only the shared booking", seen.Items)
	}
	// A private booking hides nothing from the partner's open times; a shared one does.
	open := openSlots(t, c, partner, p.Id.String())
	if !hasSlot(open, slots[0].Id.String()) || hasSlot(open, slots[1].Id.String()) {
		t.Error("partner's open times leak the private booking or show the shared one")
	}
	// Only the owner moves or cancels.
	c.Patch(bookingsPath(partner)+"/"+shared.Id.String(), map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
	c.Delete(bookingsPath(partner)+"/"+shared.Id.String(), http.StatusNotFound, nil)

	var cal httpapi.CalendarEventList
	c.Get("/api/members/"+partner.Id.String()+"/calendar-events?scope=partner", http.StatusOK, &cal)
	visits := 0
	for _, e := range cal.Items {
		if e.Kind == httpapi.CalendarEventKindProviderVisit {
			visits++
			if e.Id != shared.Id.String() {
				t.Errorf("partner calendar shows %s", e.Title)
			}
		}
	}
	if visits != 1 {
		t.Errorf("partner calendar has %d visits, want the shared one", visits)
	}

	other := testutil.New(t)
	other.StartDemo("pregnancy")
	other.Get(bookingsPath(mom), http.StatusNotFound, nil)
	other.Get(slotsPath(mom), http.StatusNotFound, nil)
	other.Delete(bookingsPath(mom)+"/"+private.Id.String(), http.StatusNotFound, nil)
}

func TestProviderBookingIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	slots := openSlots(t, c, mom, "")
	var b httpapi.ProviderBooking
	c.Post(bookingsPath(mom), httpapi.ProviderBookingInput{SlotId: slots[0].Id, Visibility: "private"}, http.StatusCreated, &b)
	c.Get(bookingsPath(mom), http.StatusOK, nil)
	c.Patch(bookingsPath(mom)+"/"+b.Id.String(), map[string]any{"visibility": "family"}, http.StatusOK, nil)
	c.Delete(bookingsPath(mom)+"/"+b.Id.String(), http.StatusNoContent, nil)
	for _, action := range []string{"create", "read", "update", "delete"} {
		if n := c.AuditCount(fam.Id, action, "provider_booking"); n != 1 {
			t.Errorf("%s audit rows = %d, want 1", action, n)
		}
	}
}
