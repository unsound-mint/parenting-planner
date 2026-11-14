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
			if _, err := q.SetTaskDone(ctx, store.SetTaskDoneParams{ID: t.ID, Done: true, DoneAt: ts(now), DoneByMemberID: uuid.NullUUID{UUID: t.AssigneeMemberID, Valid: true}}); err != nil {
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
			if _, err := q.SetTaskPendingAssignee(ctx, store.SetTaskPendingAssigneeParams{ID: created.ID, PendingAssigneeMemberID: uuid.NullUUID{UUID: *t.offered, Valid: true}}); err != nil {
				return err
			}
		}
	}
	return nil
}
