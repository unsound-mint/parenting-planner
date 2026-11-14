package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func aqPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/appointment-questions" }

func aqList(c *testutil.Client, id uuid.UUID, query string) httpapi.AppointmentQuestionList {
	var l httpapi.AppointmentQuestionList
	c.Get(aqPath(id)+query, http.StatusOK, &l)
	return l
}

func aqByText(l httpapi.AppointmentQuestionList, text string) httpapi.AppointmentQuestion {
	for _, q := range l.Items {
		if q.Text == text {
			return q
		}
	}
	return httpapi.AppointmentQuestion{}
}

func TestUnansweredQuestionsCarryOverToTheNextVisit(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	l := aqList(c, mom.Id, "")
	if len(l.Appointments) != 1 || l.Appointments[0].Kind != httpapi.CalendarEventKindAppointment || !l.Appointments[0].StartsAt.After(testutil.Now) {
		t.Fatalf("appointments = %+v", l.Appointments)
	}
	next := l.Appointments[0].Id
	back := aqByText(l, "Is the back pain normal at this stage?")
	if !back.CarriedOver || back.AppointmentId == nil || back.AppointmentId.String() != next || back.AskedForAppointmentId.String() == next {
		t.Errorf("the open question of the past visit moves to the next one: %+v", back)
	}
	if own := aqByText(l, "When should I schedule the glucose screening?"); own.CarriedOver || own.AppointmentId.String() != next {
		t.Errorf("a question for the next visit stays: %+v", own)
	}
	done := aqByText(l, "When do we sign up for the birth class?")
	if !done.Answered || done.CarriedOver || done.Answer == nil || done.AnsweredAt == nil || done.AppointmentId.String() == next {
		t.Errorf("an answered question stays at the visit it was asked for: %+v", done)
	}
	// Unanswered first, answered last.
	if !l.Items[len(l.Items)-1].Answered || l.Items[0].Answered {
		t.Errorf("order = %+v", l.Items)
	}
	// Filter by the appointment they are now under.
	if f := aqList(c, mom.Id, "?appointmentId="+next); len(f.Items) != 3 {
		t.Errorf("3 questions are under the next visit, got %d", len(f.Items))
	}

	// Answering stops the carry-over and the response says where it is.
	var upd httpapi.AppointmentQuestion
	c.Patch(aqPath(mom.Id)+"/"+back.Id.String(), map[string]any{"answered": true, "answer": "Normal, try a pregnancy belt."}, http.StatusOK, &upd)
	if !upd.Answered || upd.CarriedOver || upd.Answer == nil || upd.AppointmentId.String() == next {
		t.Errorf("updated = %+v", upd)
	}
	var reopened httpapi.AppointmentQuestion // a fresh value: absent JSON fields would keep the old ones
	c.Patch(aqPath(mom.Id)+"/"+back.Id.String(), map[string]any{"answered": false}, http.StatusOK, &reopened)
	if reopened.Answered || reopened.Answer != nil || reopened.AnsweredAt != nil || !reopened.CarriedOver {
		t.Errorf("reopened = %+v", reopened)
	}

	// Jake, as a parent, sees what Mom shared (partner and family) but not her private question.
	jl := aqList(c, jake.Id, "")
	if aqByText(jl, "Is the back pain normal at this stage?").Id == uuid.Nil || aqByText(jl, "Which vaccines does Jake need before the birth?").Id == uuid.Nil {
		t.Errorf("Jake must see the shared questions: %+v", jl.Items)
	}
	if aqByText(jl, "When should I schedule the glucose screening?").Id != uuid.Nil {
		t.Error("Jake must not see Mom's private question")
	}
}

func TestCreatingAQuestion(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	next := aqList(c, mom.Id, "").Appointments[0].Id

	var q httpapi.AppointmentQuestion
	c.Post(aqPath(jake.Id), map[string]any{"text": "Can I stay overnight?", "visibility": "partner"}, http.StatusCreated, &q)
	if q.AuthorId != jake.Id || q.Visibility != httpapi.VisibilityPartner || q.AppointmentId == nil || q.AppointmentId.String() != next || q.CarriedOver || q.Answered {
		t.Errorf("without an appointment it goes to the next one the parent may see: %+v", q)
	}
	var withID httpapi.AppointmentQuestion
	c.Post(aqPath(mom.Id), map[string]any{"text": "Birth plan?", "visibility": "private", "appointmentId": next}, http.StatusCreated, &withID)
	if withID.Visibility != httpapi.VisibilityPrivate {
		t.Errorf("the server never widens the visibility: %+v", withID)
	}
	// Validation: missing or bad visibility, empty text, too long, unknown appointment, someone else's private appointment.
	c.Post(aqPath(mom.Id), map[string]any{"text": "x"}, http.StatusBadRequest, nil)
	c.Post(aqPath(mom.Id), map[string]any{"text": "x", "visibility": "everyone"}, http.StatusBadRequest, nil)
	c.Post(aqPath(mom.Id), map[string]any{"text": "", "visibility": "private"}, http.StatusBadRequest, nil)
	long := make([]byte, 301)
	for i := range long {
		long[i] = 'a'
	}
	c.Post(aqPath(mom.Id), map[string]any{"text": string(long), "visibility": "private"}, http.StatusBadRequest, nil)
	c.Post(aqPath(mom.Id), map[string]any{"text": "x", "visibility": "private", "appointmentId": uuid.New()}, http.StatusNotFound, nil)
	private := event("Private check", "private", 48*time.Hour)
	var ev httpapi.CalendarEvent
	c.Post(calBase(mom), private, http.StatusCreated, &ev)
	c.Post(aqPath(jake.Id), map[string]any{"text": "x", "visibility": "private", "appointmentId": ev.Id}, http.StatusNotFound, nil)
}

func TestNoUpcomingAppointmentIsAConflict(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool") // no appointments at all
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Post(aqPath(mom.Id), map[string]any{"text": "x", "visibility": "private"}, http.StatusConflict, nil)
	if l := aqList(c, mom.Id, ""); len(l.Items) != 0 || len(l.Appointments) != 0 {
		t.Errorf("list = %+v", l)
	}
}

func TestOnlyTheAuthorUpdatesAndCaregiversAreRefused(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	shared := aqByText(aqList(c, mom.Id, ""), "Which vaccines does Jake need before the birth?")
	// Jake can read it, but it is not his to change; 404 does not reveal that it exists.
	c.Patch(aqPath(jake.Id)+"/"+shared.Id.String(), map[string]any{"answered": true}, http.StatusNotFound, nil)
	c.Patch(aqPath(mom.Id)+"/"+uuid.NewString(), map[string]any{"answered": true}, http.StatusNotFound, nil)
	c.Patch(aqPath(mom.Id)+"/"+shared.Id.String(), map[string]any{}, http.StatusBadRequest, nil)
	for _, cg := range fam.Caregivers {
		c.Get(aqPath(cg.Id), http.StatusForbidden, nil)
		c.Post(aqPath(cg.Id), map[string]any{"text": "x", "visibility": "family"}, http.StatusForbidden, nil)
		c.Patch(aqPath(cg.Id)+"/"+shared.Id.String(), map[string]any{"answered": true}, http.StatusNotFound, nil)
	}
}

func TestQuestionsAreAuditedScopedAndLive(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, first, httpapi.ParentRoleMother), testutil.Parent(t, first, httpapi.ParentRolePartner)
	jakeLive := openLive(t, c, jake.Id)

	var q httpapi.AppointmentQuestion
	c.Post(aqPath(mom.Id), map[string]any{"text": "A shared one", "visibility": "family"}, http.StatusCreated, &q)
	if u := next(t, jakeLive, 5*time.Second); u.Kind != "appointment_question" || u.EntityID != q.Id.String() || u.ActorID != mom.Id {
		t.Errorf("Jake is told about a shared question: %+v", u)
	}
	c.Post(aqPath(mom.Id), map[string]any{"text": "A private one", "visibility": "private"}, http.StatusCreated, nil)
	c.Patch(aqPath(mom.Id)+"/"+q.Id.String(), map[string]any{"answered": true}, http.StatusOK, nil) // a marker Jake does get
	if u := next(t, jakeLive, 5*time.Second); u.Kind != "appointment_question" || u.EntityID != q.Id.String() {
		t.Errorf("Jake must not hear about the private question, got %+v", u)
	}

	aqList(c, mom.Id, "")
	for action, want := range map[string]int{"create": 2, "update": 1, "read": 1} {
		if n := c.AuditCount(first.Id, action, "appointment_question"); n != want {
			t.Errorf("%s audit rows = %d, want %d", action, n, want)
		}
	}
	second := c.StartDemo("pregnancy") // another family's session now
	c.Patch(aqPath(testutil.Parent(t, second, httpapi.ParentRoleMother).Id)+"/"+q.Id.String(), map[string]any{"answered": false}, http.StatusNotFound, nil)
	c.Get(aqPath(mom.Id), http.StatusNotFound, nil)
}
