package appointments

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func q(seq int64, asked uuid.UUID, answered bool) store.AppointmentQuestion {
	return store.AppointmentQuestion{ID: uuid.New(), Seq: pgtype.Int8{Int64: seq, Valid: true}, AskedForEventID: asked, Answered: answered}
}

func TestResolveCarriesUnansweredQuestionsToTheOwnersNextVisit(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	mom, jake := uuid.New(), uuid.New()
	pastMom, nextMom, laterMom := uuid.New(), uuid.New(), uuid.New()
	pastJake, nextJake := uuid.New(), uuid.New()
	appts := []Appt{ // ordered by start
		{pastMom, mom, now.AddDate(0, 0, -20)},
		{pastJake, jake, now.AddDate(0, 0, -10)},
		{nextMom, mom, now.AddDate(0, 0, 3)},
		{nextJake, jake, now.AddDate(0, 0, 5)},
		{laterMom, mom, now.AddDate(0, 0, 30)},
	}
	openPast := q(1, pastMom, false)
	answeredPast := q(2, pastMom, true)
	openUpcoming := q(3, nextMom, false)
	jakesPast := q(4, pastJake, false)
	got := Resolve([]store.AppointmentQuestion{openPast, answeredPast, openUpcoming, jakesPast}, appts, now)

	by := map[uuid.UUID]Resolved{}
	for _, r := range got {
		by[r.ID] = r
	}
	if r := by[openPast.ID]; r.AppointmentID == nil || *r.AppointmentID != nextMom || !r.CarriedOver {
		t.Errorf("an open question of a past visit moves to the owner's next visit: %+v", r)
	}
	if r := by[jakesPast.ID]; r.AppointmentID == nil || *r.AppointmentID != nextJake || !r.CarriedOver {
		t.Errorf("each owner's questions go to their own next visit: %+v", r)
	}
	if r := by[answeredPast.ID]; r.AppointmentID == nil || *r.AppointmentID != pastMom || r.CarriedOver {
		t.Errorf("an answered question stays where it was asked: %+v", r)
	}
	if r := by[openUpcoming.ID]; r.AppointmentID == nil || *r.AppointmentID != nextMom || r.CarriedOver {
		t.Errorf("a question for an upcoming visit stays: %+v", r)
	}
	// Order: unanswered first (by appointment, then oldest first), answered last.
	want := []uuid.UUID{openPast.ID, openUpcoming.ID, jakesPast.ID, answeredPast.ID}
	for i, id := range want {
		if got[i].ID != id {
			t.Fatalf("position %d is seq %d, want %d", i, got[i].Seq.Int64, by[id].Seq.Int64)
		}
	}
}

func TestResolveWithNoUpcomingVisitAndHiddenAppointments(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	mom := uuid.New()
	past, hidden := uuid.New(), uuid.New()
	appts := []Appt{{past, mom, now.AddDate(0, 0, -1)}}
	open := q(1, past, false)
	got := Resolve([]store.AppointmentQuestion{open, q(2, hidden, false)}, appts, now)
	if len(got) != 1 {
		t.Fatalf("a question about an appointment the viewer may not see is dropped, got %d", len(got))
	}
	if got[0].AppointmentID != nil || got[0].CarriedOver {
		t.Errorf("with no later appointment the question is under none yet: %+v", got[0])
	}
}
