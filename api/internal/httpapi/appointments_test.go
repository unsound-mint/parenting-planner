package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestUnansweredQuestionsMoveToTheNextVisit(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/family/appointments", http.StatusUnauthorized, nil)
	c.StartDemo("pregnancy")
	var l httpapi.AppointmentList
	c.Get("/api/family/appointments", http.StatusOK, &l)
	if len(l.Items) != 2 || l.Items[0].StartsAt.Before(testutil.Now) {
		t.Fatalf("want the upcoming visit first, got %+v", l.Items)
	}
	carried := 0
	for _, q := range l.Items[0].Questions {
		if q.CarriedOver {
			carried++
		}
	}
	if len(l.Items[0].Questions) != 3 || carried != 1 {
		t.Errorf("next visit: want 2 own + 1 carried question, got %+v", l.Items[0].Questions)
	}
	if len(l.Items[1].Questions) != 1 || !l.Items[1].Questions[0].Answered {
		t.Errorf("past visit keeps only its answered question: %+v", l.Items[1].Questions)
	}
}

func TestAnsweredQuestionStopsCarryingOver(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")
	var l httpapi.AppointmentList
	c.Get("/api/family/appointments", http.StatusOK, &l)
	var carried httpapi.Question
	for _, q := range l.Items[0].Questions {
		if q.CarriedOver {
			carried = q
		}
	}
	c.Patch("/api/family/questions/"+carried.Id.String(), map[string]any{"answered": true}, http.StatusOK, nil)
	c.Get("/api/family/appointments", http.StatusOK, &l)
	for _, q := range l.Items[0].Questions {
		if q.CarriedOver {
			t.Errorf("answered question still carried: %+v", q)
		}
	}
}

func TestAppointmentsValidationAndScope(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")
	var made httpapi.Appointment
	c.Post("/api/family/appointments", map[string]any{"withName": "Lactation consultant", "startsAt": testutil.Now.AddDate(0, 0, 3).Format(time.RFC3339)}, http.StatusCreated, &made)
	c.Post("/api/family/appointments", map[string]any{"withName": "", "startsAt": "2026-12-01T10:00:00Z"}, http.StatusBadRequest, nil)
	c.Post("/api/family/appointments", map[string]any{"withName": "x", "startsAt": "tomorrow"}, http.StatusBadRequest, nil)
	var q httpapi.Question
	c.Post("/api/family/appointments/"+made.Id.String()+"/questions", map[string]any{"text": "Latch pain?"}, http.StatusCreated, &q)
	c.Post("/api/family/appointments/"+made.Id.String()+"/questions", map[string]any{"text": ""}, http.StatusBadRequest, nil)

	c.StartDemo("pregnancy") // another family now
	c.Post("/api/family/appointments/"+made.Id.String()+"/questions", map[string]any{"text": "x"}, http.StatusNotFound, nil)
	c.Patch("/api/family/questions/"+q.Id.String(), map[string]any{"answered": true}, http.StatusNotFound, nil)
}
