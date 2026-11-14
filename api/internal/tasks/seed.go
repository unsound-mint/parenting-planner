package tasks

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// SeedPaperwork adds the US paperwork checklist for the family's phase from the
// embedded catalog (internal/content/family_hub.json), alternating owners between
// the parents. Items whose key is in done are ticked by their owner. Every item
// cites a page that was opened on its checked date; deadlines are computed from
// the anchor on read.
func SeedPaperwork(ctx context.Context, q *store.Queries, familyID, mother, partner uuid.UUID, phase content.Phase, done map[string]bool, now time.Time) error {
	owners := []uuid.UUID{mother, partner}
	n := 0
	for _, p := range content.Hub().Paperwork {
		if !p.AppliesTo(phase) {
			continue
		}
		owner := owners[n%len(owners)]
		n++
		in := store.CreateTaskParams{
			FamilyID: familyID, Kind: "paperwork", Title: p.Title, Detail: &p.Short,
			AssigneeMemberID: owner, CreatedByMemberID: mother, CatalogKey: &p.Key,
			SourceTitle: &p.Source.Title, SourceUrl: &p.Source.URL, SourceCheckedOn: &p.Source.CheckedAt,
		}
		if p.Anchor != "" {
			anchor := p.Anchor
			in.DueAnchor, in.DueOffsetDays = &anchor, pgInt4(int32(p.Offset))
		}
		t, err := q.CreateTask(ctx, in)
		if err != nil {
			return err
		}
		if done[p.Key] {
			if _, err := q.SetTaskDone(ctx, store.SetTaskDoneParams{ID: t.ID, FamilyID: familyID, Done: true, DoneAt: ts(now), DoneByMemberID: uuid.NullUUID{UUID: owner, Valid: true}}); err != nil {
				return err
			}
		}
	}
	return nil
}

// SeedHospitalBag adds the three bag lists, each item with the parent who packs it.
func SeedHospitalBag(ctx context.Context, q *store.Queries, familyID, mother, partner uuid.UUID) error {
	for _, b := range []struct {
		bag, title string
		owner      uuid.UUID
	}{
		{"mother", "Photo ID and insurance card", mother},
		{"mother", "Nursing bra and comfortable robe", mother},
		{"mother", "Phone charger with a long cable", partner},
		{"baby", "Going-home outfit", mother},
		{"baby", "Rear-facing car seat, installed", partner},
		{"baby", "Newborn diapers and wipes", mother},
		{"partner", "Snacks and a change of clothes", partner},
		{"partner", "Hospital paperwork folder", partner},
	} {
		bag := b.bag
		if _, err := q.CreateTask(ctx, store.CreateTaskParams{
			FamilyID: familyID, Kind: "hospital_bag", Title: b.title, Bag: &bag, AssigneeMemberID: b.owner, CreatedByMemberID: mother,
		}); err != nil {
			return err
		}
	}
	return nil
}

// SeedPlanTasks adds a few shared tasks, one of them offered to the other parent.
func SeedPlanTasks(ctx context.Context, q *store.Queries, familyID, mother, partner uuid.UUID, today time.Time) error {
	for _, t := range []struct {
		title   string
		due     int
		owner   uuid.UUID
		offered *uuid.UUID
	}{
		{"Book the birth class", 5, partner, nil},
		{"Install the car seat", 21, mother, &partner},
		{"Pick a pediatrician", 30, mother, nil},
	} {
		due := today.AddDate(0, 0, t.due)
		created, err := q.CreateTask(ctx, store.CreateTaskParams{
			FamilyID: familyID, Kind: "task", Title: t.title, DueOn: &due, AssigneeMemberID: t.owner, CreatedByMemberID: t.owner,
		})
		if err != nil {
			return err
		}
		if t.offered != nil {
			if _, err := q.SetTaskPendingAssignee(ctx, store.SetTaskPendingAssigneeParams{ID: created.ID, FamilyID: familyID, PendingAssigneeMemberID: uuid.NullUUID{UUID: *t.offered, Valid: true}}); err != nil {
				return err
			}
		}
	}
	return nil
}
