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
// The mother has already packed three of hers, a day ago.
func SeedHospitalBag(ctx context.Context, q *store.Queries, familyID, mother, partner uuid.UUID, now time.Time) error {
	packed := 0
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
		t, err := q.CreateTask(ctx, store.CreateTaskParams{
			FamilyID: familyID, Kind: "hospital_bag", Title: b.title, Bag: &bag, AssigneeMemberID: b.owner, CreatedByMemberID: mother,
		})
		if err != nil {
			return err
		}
		if b.owner == mother && packed < 3 {
			packed++
			if err := markDone(ctx, q, familyID, t.ID, mother, now.AddDate(0, 0, -1)); err != nil {
				return err
			}
		}
	}
	return nil
}

func markDone(ctx context.Context, q *store.Queries, familyID, id, by uuid.UUID, at time.Time) error {
	_, err := q.SetTaskDone(ctx, store.SetTaskDoneParams{ID: id, FamilyID: familyID, Done: true, DoneAt: ts(at), DoneByMemberID: uuid.NullUUID{UUID: by, Valid: true}})
	return err
}

// SeedTask is one free task of a demo family. DueDays counts from today. Creator
// is who remembered it, which is not always the owner. DoneDaysAgo above 0 means
// the owner finished it that many days ago.
type SeedTask struct {
	Title       string
	DueDays     int
	Owner       uuid.UUID
	Creator     uuid.UUID
	OfferedTo   *uuid.UUID
	DoneDaysAgo int
}

// SeedTasks adds free tasks to the shared plan.
func SeedTasks(ctx context.Context, q *store.Queries, familyID uuid.UUID, rows []SeedTask, today time.Time) (map[string]uuid.UUID, error) {
	ids := map[string]uuid.UUID{}
	for _, r := range rows {
		due := today.AddDate(0, 0, r.DueDays)
		created, err := q.CreateTask(ctx, store.CreateTaskParams{
			FamilyID: familyID, Kind: "task", Title: r.Title, DueOn: &due, AssigneeMemberID: r.Owner, CreatedByMemberID: r.Creator,
		})
		if err != nil {
			return nil, err
		}
		ids[r.Title] = created.ID
		if r.OfferedTo != nil {
			if _, err := q.SetTaskPendingAssignee(ctx, store.SetTaskPendingAssigneeParams{ID: created.ID, FamilyID: familyID, PendingAssigneeMemberID: uuid.NullUUID{UUID: *r.OfferedTo, Valid: true}}); err != nil {
				return nil, err
			}
		}
		if r.DoneDaysAgo > 0 {
			if err := markDone(ctx, q, familyID, created.ID, r.Owner, today.AddDate(0, 0, -r.DoneDaysAgo).Add(18*time.Hour)); err != nil {
				return nil, err
			}
		}
	}
	return ids, nil
}

// SeedPlanTasks adds the pregnancy family's shared tasks: most of them
// remembered by the mother, one offered to the partner, two the partner has
// finished lately. It returns the day the partner finished the crib (for the
// thank-you note that goes with it).
func SeedPlanTasks(ctx context.Context, q *store.Queries, familyID, mother, partner uuid.UUID, today time.Time) error {
	_, err := SeedTasks(ctx, q, familyID, []SeedTask{
		{Title: "Book the birth class", DueDays: 5, Owner: partner, Creator: partner},
		{Title: "Install the car seat", DueDays: 21, Owner: mother, Creator: mother, OfferedTo: &partner},
		{Title: "Pick a pediatrician", DueDays: 30, Owner: mother, Creator: mother},
		{Title: "Book the 28-week checkup", DueDays: 12, Owner: mother, Creator: mother},
		{Title: "Call the clinic about the glucose test", DueDays: 8, Owner: mother, Creator: mother},
		{Title: "Buy newborn diapers and wipes", DueDays: 35, Owner: partner, Creator: mother},
		{Title: "Order the crib", DueDays: -2, Owner: partner, Creator: mother, DoneDaysAgo: CribDoneDaysAgo},
	}, today)
	return err
}

// CribDoneDaysAgo is when the partner finished the crib in the pregnancy seed;
// the seeded thank-you note names that day.
const CribDoneDaysAgo = 2

// SeedBabyTasks adds the newborn family's shared tasks.
func SeedBabyTasks(ctx context.Context, q *store.Queries, familyID, mother, partner uuid.UUID, today time.Time) error {
	_, err := SeedTasks(ctx, q, familyID, []SeedTask{
		{Title: "Book the 2-month checkup", DueDays: 6, Owner: mother, Creator: mother},
		{Title: "Call the insurer about the baby's coverage", DueDays: 9, Owner: partner, Creator: mother},
		{Title: "Buy the next size of diapers", DueDays: 3, Owner: partner, Creator: mother},
		{Title: "Order a sleep sack", DueDays: 10, Owner: mother, Creator: mother},
	}, today)
	return err
}
