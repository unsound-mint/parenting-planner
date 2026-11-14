package httpapi_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// The calendar events endpoints are still stubs (#229); replace these cases
// with real tests when their handlers land.
func TestCalendarEventsAreNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/calendar-events", nil},
		{"POST", m + "/calendar-events", map[string]any{"kind": "appointment", "title": "OB visit", "startsAt": "2026-11-20T15:00:00Z", "visibility": "family"}},
	} {
		call.expectNotImplemented(t, c)
	}
}

func question(text string, vis httpapi.Visibility) httpapi.AppointmentQuestionInput {
	return httpapi.AppointmentQuestionInput{Text: text, Visibility: vis}
}

// addAppointment inserts an appointment owned by a parent, days from the test clock.
func addAppointment(t *testing.T, c *testutil.Client, fam httpapi.Family, owner uuid.UUID, days int, visibility string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := c.Pool.QueryRow(context.Background(),
		`INSERT INTO calendar_events (family_id, owner_member_id, visibility, kind, title, starts_at)
		 VALUES ($1, $2, $3, 'appointment', 'Checkup', $4) RETURNING id`,
		fam.Id, owner, visibility, testutil.Now.AddDate(0, 0, days)).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func TestAppointmentQuestionSeedCarriesOver(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var list httpapi.AppointmentQuestionList
	c.Get("/api/members/"+mom.Id.String()+"/appointment-questions", http.StatusOK, &list)
	if len(list.Items) != 2 || len(list.Appointments) != 1 {
		t.Fatalf("mother sees %d questions and %d appointments, want 2 and 1", len(list.Items), len(list.Appointments))
	}
	next := list.Appointments[0]
	if next.Kind != httpapi.CalendarEventKindAppointment || !next.StartsAt.After(testutil.Now) {
		t.Errorf("appointments must be upcoming appointments, got %+v", next)
	}
	var carried, fresh int
	for _, it := range list.Items {
		if it.AppointmentId == nil || it.AppointmentId.String() != next.Id {
			t.Errorf("question %q is under %v, want the next visit %s", it.Text, it.AppointmentId, next.Id)
		}
		if it.CarriedOver {
			carried++
			if it.AskedForAppointmentId.String() == next.Id {
				t.Error("a carried-over question was first added to an earlier visit")
			}
		} else {
			fresh++
		}
	}
	if carried != 1 || fresh != 1 {
		t.Errorf("carried %d fresh %d, want 1 and 1", carried, fresh)
	}

	// Jake sees only the question shared with him; the carried one is Emily's private one.
	c.Get("/api/members/"+partner.Id.String()+"/appointment-questions", http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].CarriedOver || list.Items[0].AuthorId != mom.Id {
		t.Errorf("partner must see only the shared question, got %+v", list.Items)
	}
}

func TestAppointmentQuestionCarryOverStaysWithTheSameOwner(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	// Jake's visit comes before Emily's next one.
	jakes := addAppointment(t, c, fam, partner.Id, 1, "family")

	var list httpapi.AppointmentQuestionList
	c.Get("/api/members/"+mom.Id.String()+"/appointment-questions", http.StatusOK, &list)
	for _, it := range list.Items {
		if it.AppointmentId != nil && *it.AppointmentId == jakes {
			t.Fatal("a question moved to the other parent's appointment")
		}
	}

	// A new question without appointmentId goes to the author's own visit, not the sooner one.
	var q httpapi.AppointmentQuestion
	c.Post("/api/members/"+mom.Id.String()+"/appointment-questions", question("Iron?", httpapi.VisibilityPrivate), http.StatusCreated, &q)
	if q.AppointmentId == nil || *q.AppointmentId == jakes || q.CarriedOver {
		t.Errorf("default appointment = %v, want Emily's own next visit", q.AppointmentId)
	}
}

func TestAppointmentQuestionValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/appointment-questions"

	c.Post(path, question("", httpapi.VisibilityPrivate), http.StatusBadRequest, nil)
	c.Post(path, question("Hi", "everyone"), http.StatusBadRequest, nil)
	c.Post(path, map[string]any{"text": "No visibility"}, http.StatusBadRequest, nil)
	c.Patch(path+"/"+uuid.NewString(), map[string]any{}, http.StatusBadRequest, nil)
	c.Get(path+"?appointmentId=nope", http.StatusBadRequest, nil)

	// An appointment id that is not an appointment the parent may see is 404.
	c.Post(path, httpapi.AppointmentQuestionInput{Text: "Hi", Visibility: httpapi.VisibilityPrivate, AppointmentId: ptr(uuid.New())}, http.StatusNotFound, nil)
}

func ptr[T any](v T) *T { return &v }

func TestAppointmentQuestionNeedsAnAppointment(t *testing.T) {
	c := testutil.New(t)
	// The planning family has no appointments.
	mom := testutil.Parent(t, c.StartDemo("planning"), httpapi.ParentRoleMother)
	var e httpapi.Error
	c.Post("/api/members/"+mom.Id.String()+"/appointment-questions", question("Hi", httpapi.VisibilityPrivate), http.StatusConflict, &e)
	if e.Code != "no_upcoming_appointment" {
		t.Errorf("code = %q", e.Code)
	}
}

func TestAppointmentQuestionPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	momPath := "/api/members/" + mom.Id.String() + "/appointment-questions"
	partnerPath := "/api/members/" + partner.Id.String() + "/appointment-questions"

	count := func(path string) int {
		var l httpapi.AppointmentQuestionList
		c.Get(path, http.StatusOK, &l)
		return len(l.Items)
	}
	momBefore, partnerBefore := count(momPath), count(partnerPath)

	var priv, shared httpapi.AppointmentQuestion
	c.Post(momPath, question("Private one", httpapi.VisibilityPrivate), http.StatusCreated, &priv)
	c.Post(momPath, question("Shared one", httpapi.VisibilityFamily), http.StatusCreated, &shared)
	c.Post(momPath, question("Care team only", httpapi.VisibilityCareTeam), http.StatusCreated, nil)
	if got := count(momPath) - momBefore; got != 3 {
		t.Errorf("author sees %d new questions, want 3", got)
	}
	if got := count(partnerPath) - partnerBefore; got != 1 {
		t.Errorf("partner sees %d new questions, want only the shared one", got)
	}

	// The partner may not change Emily's question, shared or not, and learns nothing about it.
	for _, id := range []uuid.UUID{priv.Id, shared.Id, uuid.New()} {
		c.Patch(partnerPath+"/"+id.String(), map[string]any{"answered": true}, http.StatusNotFound, nil)
	}
	// A parent in another family is a stranger: no such member.
	other := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c.Patch("/api/members/"+other.Id.String()+"/appointment-questions/"+priv.Id.String(), map[string]any{"answered": true}, http.StatusNotFound, nil)
	c.Get("/api/members/"+mom.Id.String()+"/appointment-questions", http.StatusNotFound, nil)
}

func TestAppointmentQuestionAnswerAndReopen(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/appointment-questions"

	var list httpapi.AppointmentQuestionList
	c.Get(path, http.StatusOK, &list)
	var carried httpapi.AppointmentQuestion
	for _, it := range list.Items {
		if it.CarriedOver {
			carried = it
		}
	}
	if carried.Id == uuid.Nil {
		t.Fatal("seed has no carried-over question")
	}

	var got httpapi.AppointmentQuestion
	c.Patch(path+"/"+carried.Id.String(), map[string]any{"answered": true, "answer": "Normal, rest on your left side."}, http.StatusOK, &got)
	if !got.Answered || got.AnsweredAt == nil || got.Answer == nil || got.CarriedOver {
		t.Errorf("answered question = %+v", got)
	}
	if got.AppointmentId == nil || *got.AppointmentId != carried.AskedForAppointmentId {
		t.Errorf("an answered question stays under the visit it was asked for, got %v", got.AppointmentId)
	}
	c.Get(path, http.StatusOK, &list)
	if len(list.Items) != 2 || list.Items[len(list.Items)-1].Id != carried.Id {
		t.Errorf("answered questions come last and stay for 30 days, got %+v", list.Items)
	}

	got = httpapi.AppointmentQuestion{}
	c.Patch(path+"/"+carried.Id.String(), map[string]any{"answered": false}, http.StatusOK, &got)
	if got.Answered || got.Answer != nil || !got.CarriedOver {
		t.Errorf("reopened question must be unanswered and carried over again, got %+v", got)
	}

	// Filter by appointment.
	var only httpapi.AppointmentQuestionList
	c.Get(path+"?appointmentId="+carried.AppointmentId.String(), http.StatusOK, &only)
	if len(only.Items) != 2 {
		t.Errorf("appointmentId filter returned %d, want 2", len(only.Items))
	}
	c.Get(path+"?appointmentId="+uuid.NewString(), http.StatusOK, &only)
	if len(only.Items) != 0 {
		t.Errorf("unknown appointment returned %d questions", len(only.Items))
	}
}

func TestAppointmentQuestionIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := "/api/members/" + mom.Id.String() + "/appointment-questions"

	var q httpapi.AppointmentQuestion
	c.Post(path, question("Iron?", httpapi.VisibilityPrivate), http.StatusCreated, &q)
	c.Get(path, http.StatusOK, nil)
	c.Patch(path+"/"+q.Id.String(), map[string]any{"answered": true}, http.StatusOK, nil)
	for _, action := range []string{"create", "read", "update"} {
		if n := c.AuditCount(fam.Id, action, "appointment_question"); n != 1 {
			t.Errorf("%s audit rows = %d, want 1", action, n)
		}
	}
}
