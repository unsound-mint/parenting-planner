package httpapi_test

import (
	"net/http"
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

// titles lists the stored events only: seeded tasks also appear in the feed and have their own test.
func titles(l httpapi.CalendarEventList) []string {
	out := []string{}
	for _, e := range l.Items {
		if e.Kind == httpapi.CalendarEventKindTask {
			continue
		}
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
	get := func(p httpapi.Parent, q string) []string { c.Get(calBase(p)+q, http.StatusOK, &l); return titles(l) }
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
		t.Fatalf("mom does not see her booked session: %v", titles(l))
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
	if got := titles(l); len(got) != 1 || got[0] != "Baby class" {
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
	if len(titles(l)) != 0 {
		t.Errorf("another family's events leaked: %v", titles(l))
	}
	if n := c.AuditCount(first.Id, "create", "calendar_event"); n != 1 {
		t.Errorf("create audit rows = %d, want 1", n)
	}
}

func TestTaskDeadlinesAppearInTheCalendarAndToday(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	// Jake owns "Book the birth class", due in 5 days; Mom owns the car seat (21 days) and the pediatrician (30).
	feed := func(p httpapi.Parent, scope string) []httpapi.CalendarEvent {
		var l httpapi.CalendarEventList
		c.Get(calBase(p)+"?scope="+scope+"&from=2026-11-14&to=2026-12-14", http.StatusOK, &l)
		var out []httpapi.CalendarEvent
		for _, e := range l.Items {
			if e.Kind == httpapi.CalendarEventKindTask {
				out = append(out, e)
			}
		}
		return out
	}
	if got := feed(jake, "mine"); len(got) != 1 || got[0].Title != "Book the birth class" || !got[0].AllDay || got[0].TaskId == nil || got[0].OwnerId == nil || *got[0].OwnerId != jake.Id {
		t.Fatalf("Jake's own tasks = %+v", got)
	}
	if got := feed(mom, "partner"); len(got) != 1 || got[0].Title != "Book the birth class" {
		t.Errorf("Mom sees Jake's task under partner: %+v", got)
	}
	if got := feed(mom, "mine"); len(got) < 2 {
		t.Errorf("Mom's own tasks: %+v", got)
	}

	// A ticked task leaves the calendar.
	var l httpapi.TaskList
	c.Get(tasksPath(mom.Id)+"?kind=task", http.StatusOK, &l)
	c.Patch(tasksPath(mom.Id)+"/"+byTitle(l.Items, "Book the birth class").Id.String(), map[string]any{"done": true}, http.StatusOK, nil)
	if got := feed(jake, "mine"); len(got) != 0 {
		t.Errorf("a done task must leave the calendar: %+v", got)
	}

	// Today: the person's tasks due within 7 days, then the ones offered to them.
	var td httpapi.Today
	c.Get(todayPath(jake.Id), http.StatusOK, &td)
	if len(td.Tasks) != 1 || td.Tasks[0].Title != "Install the car seat" || td.Tasks[0].PendingAssigneeId == nil {
		t.Errorf("Jake's Today shows the task offered to him: %+v", td.Tasks)
	}
	var mt httpapi.Today
	c.Get(todayPath(mom.Id), http.StatusOK, &mt)
	for _, tk := range mt.Tasks {
		if tk.AssigneeId != mom.Id || tk.Kind == httpapi.TaskKindHospitalBag {
			t.Errorf("Mom's Today must hold only her own tasks: %+v", tk)
		}
	}
}
