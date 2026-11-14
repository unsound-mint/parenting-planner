package httpapi_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func birthPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/birth-plan" }
func alertPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/labour-alerts" }

func TestBirthPlanHasTheHospitalContactsAndDocuments(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get(birthPath(testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)), http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var p httpapi.BirthPlan
	c.Get(birthPath(mom), http.StatusOK, &p)
	h := p.Hospital
	if h.Name != "Riverbend Women's Hospital" || h.Address == "" || h.Phone == nil || h.TravelMinutes == nil || *h.TravelMinutes != 18 {
		t.Errorf("hospital = %+v", h)
	}
	if h.MapsUrl == nil || *h.MapsUrl != "https://www.google.com/maps/dir/?api=1&destination=1200+Riverbend+Dr%2C+Austin%2C+TX+78701" {
		t.Errorf("maps url = %v", h.MapsUrl)
	}
	// In calling order: the desk, the OB, then the other parent (not the viewer).
	if len(p.Contacts) != 3 || p.Contacts[0].Label != "Labour and delivery desk" || p.Contacts[1].Label != "Your OB" || p.Contacts[1].Name != "Dr. Priya Shah" || p.Contacts[2].MemberId == nil || *p.Contacts[2].MemberId != jake.Id {
		t.Errorf("contacts = %+v", p.Contacts)
	}
	var jp httpapi.BirthPlan
	c.Get(birthPath(jake), http.StatusOK, &jp)
	if last := jp.Contacts[len(jp.Contacts)-1]; last.MemberId == nil || *last.MemberId != mom.Id {
		t.Errorf("Jake's last contact is Mom: %+v", last)
	}
	if len(p.Documents) == 0 || p.PreferencesNote == nil {
		t.Errorf("documents and the preferences note: %+v", p)
	}
	for _, d := range p.Documents {
		// Ready follows the linked task (the demo mother has packed her ID);
		// an item with no task is never ready.
		if d.Title == "" || (d.TaskId == nil && d.Ready) {
			t.Errorf("an item with no paperwork task is not ready: %+v", d)
		}
	}
}

func TestBirthPlanIsHiddenFromCaregiversAndInLossSupport(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	for _, cg := range fam.Caregivers {
		c.Get("/api/members/"+cg.Id.String()+"/birth-plan", http.StatusNotFound, nil)
		c.Post("/api/members/"+cg.Id.String()+"/labour-alerts", nil, http.StatusNotFound, nil)
	}
	c.Get(birthPath(mom), http.StatusOK, nil)
	c.Post(lossPath(mom.Id), map[string]any{}, http.StatusCreated, nil)
	c.Get(birthPath(mom), http.StatusNotFound, nil)
	c.Post(alertPath(mom), nil, http.StatusNotFound, nil)
	c.Delete(lossPath(mom.Id), http.StatusOK, nil)
	c.Get(birthPath(mom), http.StatusOK, nil) // back when support is undone

	// A family with no birth plan: 404; another family's parent: 404.
	other := c.StartDemo("newborn")
	c.Get(birthPath(testutil.Parent(t, other, httpapi.ParentRoleMother)), http.StatusNotFound, nil)
	c.Get(birthPath(mom), http.StatusNotFound, nil)
}

func TestLabourAlertNotifiesThePartnerOnceWithNoHealthText(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	c.Post(alertPath(mom), nil, http.StatusNoContent, nil)
	got := ofKind(bell(c, jake), httpapi.NotificationKind("labour_started"))
	if len(got) != 1 || got[0].Title != "Emily says labour has started" {
		t.Fatalf("Jake's bell = %+v", got)
	}
	if got[0].EntityId == nil || *got[0].EntityId != mom.Id.String() {
		t.Errorf("the entity is the sender: %+v", got[0])
	}
	if n := len(ofKind(bell(c, mom), httpapi.NotificationKind("labour_started"))); n != 0 {
		t.Errorf("the sender gets nothing, got %d", n)
	}
	// A second tap inside the ten minutes is accepted and sends nothing; so is the other parent's.
	c.Post(alertPath(mom), nil, http.StatusNoContent, nil)
	c.Post(alertPath(jake), nil, http.StatusNoContent, nil)
	if n := len(ofKind(bell(c, jake), httpapi.NotificationKind("labour_started"))); n != 1 {
		t.Errorf("one alert per family per ten minutes, Jake has %d", n)
	}
	if n := len(ofKind(bell(c, mom), httpapi.NotificationKind("labour_started"))); n != 0 {
		t.Errorf("Mom got %d", n)
	}
	// After the window a new alert goes out.
	if _, err := c.Pool.Exec(context.Background(), `UPDATE notifications SET created_at = $2 WHERE family_id = $1 AND kind = 'labour_started'`, fam.Id, testutil.Now.Add(-11*time.Minute)); err != nil {
		t.Fatal(err)
	}
	c.Post(alertPath(jake), nil, http.StatusNoContent, nil)
	if n := len(ofKind(bell(c, mom), httpapi.NotificationKind("labour_started"))); n != 1 {
		t.Errorf("after ten minutes Mom hears from Jake, got %d", n)
	}
	testutil.New(t).Post(alertPath(mom), nil, http.StatusUnauthorized, nil)
	c.Post("/api/members/"+uuid.NewString()+"/labour-alerts", nil, http.StatusNotFound, nil)
}

func TestAppointmentPrepUsesConfiguredDriveTime(t *testing.T) {
	c := testutil.New(t)
	f := c.StartDemo("pregnancy")
	m := testutil.Parent(t, f, httpapi.ParentRoleMother)
	questions := aqList(c, m.Id, "")
	if len(questions.Appointments) == 0 {
		t.Fatal("no seeded appointment")
	}
	var prep httpapi.AppointmentPrep
	c.Get("/api/members/"+m.Id.String()+"/appointments/"+questions.Appointments[0].Id+"/prep", http.StatusOK, &prep)
	if prep.Travel == nil || prep.Travel.Minutes != 28 || !prep.Travel.LeaveBy.Equal(prep.Appointment.StartsAt.Add(-28*time.Minute)) {
		t.Fatalf("travel: %+v", prep.Travel)
	}
	if len(prep.Documents) == 0 || prep.Documents[0].TaskId == nil {
		t.Fatalf("missing document task link: %+v", prep.Documents)
	}
	ev := event("Appointment at another clinic", "family", 24*time.Hour)
	ev["location"] = "123 Other Road"
	var saved httpapi.CalendarEvent
	c.Post(calBase(m), ev, http.StatusCreated, &saved)
	prep = httpapi.AppointmentPrep{}
	c.Get("/api/members/"+m.Id.String()+"/appointments/"+saved.Id+"/prep", http.StatusOK, &prep)
	if prep.Travel != nil {
		t.Fatalf("unexpected trip estimate: %+v", prep.Travel)
	}
}
