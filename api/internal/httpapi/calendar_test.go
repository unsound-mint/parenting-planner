package httpapi_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func calBase(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/calendar-events" }

func event(title, vis string, startsIn time.Duration, attendees ...uuid.UUID) map[string]any {
	if attendees == nil {
		attendees = []uuid.UUID{}
	}
	return map[string]any{
		"kind": "appointment", "title": title, "startsAt": testutil.Now.Add(startsIn).Format(time.RFC3339),
		"visibility": vis, "attendeeIds": attendees,
	}
}

func calTitles(l httpapi.CalendarEventList) []string {
	out := []string{}
	for _, e := range l.Items {
		out = append(out, e.Title)
	}
	return out
}

// The stubs for appointment questions are still 501 until #253.
func TestAppointmentQuestionsAreNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/appointment-questions", map[string]any{"text": "Is my iron level fine?", "visibility": "private"}},
		{"GET", m + "/appointment-questions", nil},
		{"PATCH", m + "/appointment-questions/00000000-0000-4000-8000-000000000001", map[string]any{"answered": true}},
	} {
		call.expectNotImplemented(t, c)
	}
}

func TestUpdateCalendarEventHidesPrivateDetailsFromExports(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	base := calBase(p.mom)
	in := event("Sensitive appointment", "family", time.Hour, p.nanny.Id)
	in["location"] = "Private address"
	var e httpapi.CalendarEvent
	c.Post(base, in, http.StatusCreated, &e)
	c.Patch(calBase(p.partner)+"/"+e.Id, map[string]any{"title": "other"}, http.StatusNotFound, nil)
	c.Patch("/api/members/"+p.nanny.Id.String()+"/calendar-events/"+e.Id, map[string]any{"title": "other"}, http.StatusForbidden, nil)
	c.Patch(base+"/"+uuid.NewString(), map[string]any{"title": "other"}, http.StatusNotFound, nil)
	c.Patch(base+"/"+e.Id, map[string]any{"neutralTitle": true}, http.StatusOK, &e)
	if e.Title != "Sensitive appointment" || e.NeutralTitle == nil || !*e.NeutralTitle {
		t.Fatalf("in-app appointment: %+v", e)
	}
	link := feedLink(t, c, "/api/members/"+p.mom.Id.String(), "mine")
	code, file := c.Raw(http.MethodGet, link, "", nil)
	if code != http.StatusOK || !strings.Contains(string(file), "SUMMARY:Appointment") ||
		strings.Contains(string(file), "Sensitive appointment") || strings.Contains(string(file), "Private address") {
		t.Fatalf("calendar export %d: %s", code, file)
	}
	c.Patch(base+"/"+e.Id, map[string]any{"visibility": "private"}, http.StatusOK, &e)
	if len(e.AttendeeIds) != 0 {
		t.Fatalf("private event still has attendees: %+v", e.AttendeeIds)
	}
}

func TestCalendarValidation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Post(calBase(mom), map[string]any{"kind": "shift", "title": "x", "startsAt": "2026-11-20T15:00:00Z", "visibility": "family"}, http.StatusBadRequest, nil) // shifts have their own endpoint
	c.Post(calBase(mom), map[string]any{"kind": "other", "title": "", "startsAt": "2026-11-20T15:00:00Z", "visibility": "family"}, http.StatusBadRequest, nil)
	c.Post(calBase(mom), map[string]any{"kind": "other", "title": "x", "startsAt": "2026-11-20T15:00:00Z", "visibility": "partner"}, http.StatusBadRequest, nil)
	bad := event("x", "family", time.Hour, uuid.New()) // not a person of this family
	c.Post(calBase(mom), bad, http.StatusBadRequest, nil)
	back := event("x", "family", time.Hour)
	back["endsAt"] = testutil.Now.Format(time.RFC3339)
	c.Post(calBase(mom), back, http.StatusBadRequest, nil)
	c.Get(calBase(mom)+"?scope=everyone", http.StatusBadRequest, nil)
	c.Get(calBase(mom)+"?from=2026-11-14&to=2026-12-31", http.StatusBadRequest, nil)
	c.Get(calBase(mom)+"?from=2026-11-14&to=2026-11-10", http.StatusBadRequest, nil)
}

func TestCalendarScopesAndPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	c.Post(calBase(mom), event("OB visit", "family", 24*time.Hour, jake.Id), http.StatusCreated, nil)
	c.Post(calBase(mom), event("Therapy intake", "private", 48*time.Hour), http.StatusCreated, nil)
	c.Post(calBase(jake), event("Dentist", "family", 72*time.Hour), http.StatusCreated, nil)
	c.Post(calBase(jake), event("Private errand", "private", 96*time.Hour), http.StatusCreated, nil)

	var l httpapi.CalendarEventList
	get := func(p httpapi.Parent, q string) []string { c.Get(calBase(p)+q, http.StatusOK, &l); return calTitles(l) }
	eq := func(name string, got, want []string) {
		t.Helper()
		if len(got) != len(want) {
			t.Errorf("%s = %v, want %v", name, got, want)
			return
		}
		for i := range got {
			if got[i] != want[i] {
				t.Errorf("%s = %v, want %v", name, got, want)
			}
		}
	}
	eq("mom family (default)", get(mom, ""), []string{"OB visit", "Therapy intake", "Dentist"})
	eq("mom mine", get(mom, "?scope=mine"), []string{"OB visit", "Therapy intake"})
	eq("mom partner", get(mom, "?scope=partner"), []string{"Dentist"})
	eq("jake mine (owns and attends)", get(jake, "?scope=mine"), []string{"OB visit", "Dentist", "Private errand"})
	eq("jake partner", get(jake, "?scope=partner"), []string{"OB visit"})
	eq("jake family", get(jake, "?scope=family"), []string{"OB visit", "Dentist", "Private errand"})
	if l.From.Format("2006-01-02") != "2026-11-14" || l.To.Format("2006-01-02") != "2026-11-20" {
		t.Errorf("default window = %v to %v, want today and the next 6 days", l.From, l.To)
	}
	eq("window narrows", get(mom, "?from=2026-11-16&to=2026-11-16"), []string{"Therapy intake"})
	eq("outside the window", get(mom, "?from=2026-12-01&to=2026-12-02"), []string{})
}

func TestCalendarShowsOwnPsychologistSessionOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var slots httpapi.PsychologistSlots
	c.Get(careBase(mom)+"/psychologist-slots", http.StatusOK, &slots)
	c.Post(careBase(mom)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: slots.Items[0].Id}, http.StatusCreated, nil)

	var l httpapi.CalendarEventList
	c.Get(calBase(mom)+"?scope=mine&to=2026-11-28", http.StatusOK, &l)
	found := false
	for _, e := range l.Items {
		if e.Kind == httpapi.CalendarEventKindPsychologistSession {
			found = true
			if e.Visibility != httpapi.CalendarVisibilityPrivate || e.EndsAt == nil || *e.OwnerId != mom.Id {
				t.Errorf("session = %+v", e)
			}
		}
	}
	if !found {
		t.Fatalf("mom does not see her booked session: %v", calTitles(l))
	}
	for _, scope := range []string{"family", "partner", "mine"} {
		c.Get(calBase(jake)+"?scope="+scope+"&to=2026-11-28", http.StatusOK, &l)
		for _, e := range l.Items {
			if e.Kind == httpapi.CalendarEventKindPsychologistSession {
				t.Errorf("partner sees mom's session under %s", scope)
			}
		}
	}
}

func TestCaregiverCalendarIsLimited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var grandma, nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleGrandparent {
			grandma = cg
		} else {
			nanny = cg
		}
	}
	c.Post(calBase(mom), event("OB visit", "family", 24*time.Hour, nanny.Id), http.StatusCreated, nil) // a parent's appointment
	cls := event("Baby class", "family", 48*time.Hour, nanny.Id, grandma.Id)
	cls["kind"] = "class"
	c.Post(calBase(mom), cls, http.StatusCreated, nil)
	hidden := event("Date night", "private", 72*time.Hour, nanny.Id)
	hidden["kind"] = "other"
	c.Post(calBase(mom), hidden, http.StatusCreated, nil)
	unattended := event("Not for the nanny", "family", 96*time.Hour)
	unattended["kind"] = "other"
	c.Post(calBase(mom), unattended, http.StatusCreated, nil)

	nannyCal := "/api/members/" + nanny.Id.String() + "/calendar-events"
	var l httpapi.CalendarEventList
	c.Get(nannyCal, http.StatusOK, &l)
	if got := calTitles(l); len(got) != 1 || got[0] != "Baby class" {
		t.Errorf("nanny sees %v, want only the class she attends", got)
	}
	c.Get(nannyCal+"?scope=mine", http.StatusOK, nil)
	c.Get(nannyCal+"?scope=family", http.StatusForbidden, nil)
	c.Get(nannyCal+"?scope=partner", http.StatusForbidden, nil)
	c.Post(nannyCal, event("x", "family", time.Hour), http.StatusForbidden, nil)

	// Without the schedule permission a caregiver gets 403.
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{care_log}' WHERE id = $1`, nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(nannyCal, http.StatusForbidden, nil)
}

func TestCalendarIsScopedToTheFamily(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	momA := testutil.Parent(t, first, httpapi.ParentRoleMother)
	c.Post(calBase(momA), event("A's visit", "family", time.Hour), http.StatusCreated, nil)
	second := c.StartDemo("pregnancy")
	c.Get(calBase(momA), http.StatusNotFound, nil)
	var l httpapi.CalendarEventList
	c.Get(calBase(testutil.Parent(t, second, httpapi.ParentRoleMother)), http.StatusOK, &l)
	if len(l.Items) != 0 {
		t.Errorf("another family's events leaked: %v", calTitles(l))
	}
	if n := c.AuditCount(first.Id, "create", "calendar_event"); n != 1 {
		t.Errorf("create audit rows = %d, want 1", n)
	}
}
