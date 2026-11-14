package tasks

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// checked is the day each paperwork source below was opened and read.
var checked = time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)

type paperwork struct {
	title, detail string
	anchor        string
	offset        int32
	srcTitle      string
	srcURL        string
}

// Paperwork is the seeded US paperwork checklist. Every item cites a page that
// was opened on its checked date; deadlines are computed from the anchor.
var paperworkCatalog = []paperwork{
	{
		title:  "Tell your employer you will take parental leave",
		detail: "When the leave is foreseeable because of an expected birth, the employee must give at least 30 days' notice before it begins; if that is not practicable, as soon as practicable. The date here assumes leave starts at the due date.",
		anchor: "due_date", offset: -30,
		srcTitle: "29 CFR 825.302: Employee notice requirements for foreseeable FMLA leave", srcURL: "https://www.law.cornell.edu/cfr/text/29/825.302",
	},
	{
		title:  "Add the baby to your health insurance",
		detail: "On a Marketplace plan, having a baby opens a Special Enrollment Period of 60 days, and coverage can start on the day of the birth. Employer plans can have their own window: ask HR.",
		anchor: "birth_date", offset: 60,
		srcTitle: "HealthCare.gov: Special Enrollment Period", srcURL: "https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/",
	},
	{
		title:  "Use your bonding leave within the first year",
		detail: "FMLA leave to care for a newborn must be taken within one year of the birth, up to 12 workweeks in a 12-month period for eligible employees.",
		anchor: "birth_date", offset: 365,
		srcTitle: "U.S. Department of Labor: Family and Medical Leave Act", srcURL: "https://www.dol.gov/agencies/whd/fmla",
	},
}

// SeedPaperwork adds the paperwork checklist, alternating owners between the parents.
// Items listed in done are ticked by the owner.
func SeedPaperwork(ctx context.Context, q *store.Queries, familyID, mother, partner uuid.UUID, done map[int]bool, now time.Time) error {
	owners := []uuid.UUID{partner, mother, mother}
	for i, p := range paperworkCatalog {
		anchor, offset := p.anchor, p.offset
		t, err := q.CreateTask(ctx, store.CreateTaskParams{
			FamilyID: familyID, Kind: "paperwork", Title: p.title, Detail: &p.detail,
			DueAnchor: &anchor, DueOffsetDays: pgInt4(offset), AssigneeMemberID: owners[i%len(owners)], CreatedByMemberID: mother,
			SourceTitle: &p.srcTitle, SourceUrl: &p.srcURL, SourceCheckedOn: &checked,
		})
		if err != nil {
			return err
		}
		if done[i] {
			if _, err := q.SetTaskDone(ctx, store.SetTaskDoneParams{ID: t.ID, FamilyID: familyID, Done: true, DoneAt: ts(now), DoneByMemberID: uuid.NullUUID{UUID: t.AssigneeMemberID, Valid: true}}); err != nil {
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
