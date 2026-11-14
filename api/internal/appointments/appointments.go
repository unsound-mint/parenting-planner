// Package appointments groups questions under appointments and carries
// unanswered questions of past visits over to the next one.
package appointments

import (
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

type Question struct {
	ID          uuid.UUID
	Text        string
	Answered    bool
	CarriedOver bool
}

type Appointment struct {
	ID        uuid.UUID
	WithName  string
	StartsAt  time.Time
	Questions []Question
}

// Assemble returns the next upcoming appointment first, then later ones, then
// past ones (most recent first). An unanswered question of a past appointment
// is shown on the next upcoming appointment, not on the past one. With no
// upcoming appointment, questions stay where they were asked.
func Assemble(appts []store.Appointment, questions []store.AppointmentQuestion, now time.Time) []Appointment {
	byAppt := map[uuid.UUID][]store.AppointmentQuestion{}
	for _, q := range questions {
		byAppt[q.AppointmentID] = append(byAppt[q.AppointmentID], q)
	}
	var upcoming, past []Appointment
	for _, a := range appts { // appts are ordered by starts_at
		item := Appointment{ID: a.ID, WithName: a.WithName, StartsAt: a.StartsAt, Questions: []Question{}}
		for _, q := range byAppt[a.ID] {
			item.Questions = append(item.Questions, Question{ID: q.ID, Text: q.Body, Answered: q.Answered})
		}
		if a.StartsAt.Before(now) {
			past = append(past, item)
		} else {
			upcoming = append(upcoming, item)
		}
	}
	if len(upcoming) > 0 {
		for i := range past {
			kept := past[i].Questions[:0]
			for _, q := range past[i].Questions {
				if q.Answered {
					kept = append(kept, q)
					continue
				}
				q.CarriedOver = true
				upcoming[0].Questions = append(upcoming[0].Questions, q)
			}
			past[i].Questions = kept
		}
	}
	out := upcoming
	for i := len(past) - 1; i >= 0; i-- {
		out = append(out, past[i])
	}
	return out
}
