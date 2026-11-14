package appointments

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func TestAssembleCarriesUnansweredQuestionsToTheNextVisit(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	pastA, pastB, next, later := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	appts := []store.Appointment{
		{ID: pastA, WithName: "old", StartsAt: now.AddDate(0, 0, -30)},
		{ID: pastB, WithName: "recent", StartsAt: now.AddDate(0, 0, -7)},
		{ID: next, WithName: "next", StartsAt: now.AddDate(0, 0, 5)},
		{ID: later, WithName: "later", StartsAt: now.AddDate(0, 0, 20)},
	}
	qs := []store.AppointmentQuestion{
		{ID: uuid.New(), AppointmentID: pastA, Body: "open old"},
		{ID: uuid.New(), AppointmentID: pastB, Body: "answered", Answered: true},
		{ID: uuid.New(), AppointmentID: pastB, Body: "open recent"},
		{ID: uuid.New(), AppointmentID: next, Body: "own"},
		{ID: uuid.New(), AppointmentID: later, Body: "later own"},
	}
	got := Assemble(appts, qs, now)
	if got[0].WithName != "next" || got[1].WithName != "later" || got[2].WithName != "recent" || got[3].WithName != "old" {
		t.Fatalf("order = %v", []string{got[0].WithName, got[1].WithName, got[2].WithName, got[3].WithName})
	}
	var texts []string
	for _, q := range got[0].Questions {
		texts = append(texts, q.Text)
		if q.CarriedOver != (q.Text != "own") {
			t.Errorf("%q carriedOver = %v", q.Text, q.CarriedOver)
		}
	}
	if len(texts) != 3 {
		t.Errorf("next visit questions = %v, want own + 2 carried", texts)
	}
	if len(got[2].Questions) != 1 || !got[2].Questions[0].Answered || len(got[3].Questions) != 0 {
		t.Errorf("past visits keep only answered questions: %+v %+v", got[2].Questions, got[3].Questions)
	}
	if len(got[1].Questions) != 1 {
		t.Errorf("later visit must not get carried questions: %+v", got[1].Questions)
	}
}

func TestAssembleKeepsQuestionsWhenNothingIsUpcoming(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	id := uuid.New()
	got := Assemble([]store.Appointment{{ID: id, StartsAt: now.AddDate(0, 0, -1)}},
		[]store.AppointmentQuestion{{ID: uuid.New(), AppointmentID: id, Body: "open"}}, now)
	if len(got) != 1 || len(got[0].Questions) != 1 || got[0].Questions[0].CarriedOver {
		t.Errorf("got %+v", got)
	}
}
