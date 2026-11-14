// Package live records "something changed" events that the server-sent-events
// stream (GET /members/{id}/live) hands to the right people. Domain code calls
// Publish inside the transaction that made the change, so an event exists only
// if the change does. Events carry the kind and the id, never the content.
package live

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Kinds, as in the contract's LiveUpdateKind.
const (
	Family              = "family"
	Task                = "task"
	Shift               = "shift"
	CalendarEvent       = "calendar_event"
	CareLog             = "care_log"
	Handoff             = "handoff"
	AppointmentQuestion = "appointment_question"
	Invitation          = "invitation"
	// Not published yet. Each is sent by the module's own PR or follow-up, in the
	// transaction that makes the change: leave_plan by updateLeavePlan (#410),
	// insurance_call by createInsuranceCall (#413), notification by notify.Send
	// and diary_entry by the diary writes (both on main, still to wire; a diary
	// event goes only to the author and, for a shared entry, the partner).
	Notification  = "notification"
	LeavePlan     = "leave_plan"
	DiaryEntry    = "diary_entry"
	InsuranceCall = "insurance_call"
)

// Retention is how long events are kept; a client that was offline longer refetches everything anyway.
const Retention = time.Hour

type Event struct {
	Kind     string
	EntityID string
	Actor    uuid.UUID
	// Audience lists who is told. Nil means the whole family.
	Audience []uuid.UUID
	// NeedsPermission is required of caregivers; parents always pass.
	NeedsPermission string
}

// Publish records an event and prunes old ones.
func Publish(ctx context.Context, q *store.Queries, familyID uuid.UUID, e Event, now time.Time) error {
	var entity, needs *string
	if e.EntityID != "" {
		entity = &e.EntityID
	}
	if e.NeedsPermission != "" {
		needs = &e.NeedsPermission
	}
	if _, err := q.InsertLiveEvent(ctx, store.InsertLiveEventParams{
		FamilyID: familyID, Kind: e.Kind, EntityID: entity, ActorMemberID: e.Actor,
		Audience: e.Audience, NeedsPermission: needs, At: now,
	}); err != nil {
		return err
	}
	return q.PruneLiveEvents(ctx, now.Add(-Retention))
}

// ParentsAnd returns the family's parents plus the given people, once each.
func ParentsAnd(ctx context.Context, q *store.Queries, familyID uuid.UUID, extra ...uuid.UUID) ([]uuid.UUID, error) {
	parents, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	seen := map[uuid.UUID]bool{}
	out := make([]uuid.UUID, 0, len(parents)+len(extra))
	for _, id := range append(idsOf(parents), extra...) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out, nil
}

func idsOf(ms []store.Member) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(ms))
	for _, m := range ms {
		out = append(out, m.ID)
	}
	return out
}
