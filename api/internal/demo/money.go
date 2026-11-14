package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

type budgetSeed struct {
	category, name, cadence, payer string
	dollars                        int64
}

// A first baby: the lines a family fills in during pregnancy and the first months.
var babyBudget = []budgetSeed{
	{"pregnancy_care", "Prenatal vitamins", "monthly", "mother", 25},
	{"pregnancy_care", "Prenatal visit copays", "once", "shared", 600},
	{"pregnancy_care", "Childbirth class", "once", "shared", 150},
	{"delivery", "Hospital and doctor bills (your share)", "once", "shared", 3000},
	{"delivery", "Newborn medical bills (your share)", "once", "shared", 500},
	{"equipment", "Car seat", "once", "partner", 250},
	{"equipment", "Crib and mattress", "once", "partner", 400},
	{"equipment", "Stroller", "once", "mother", 350},
	{"equipment", "Clothes and swaddles", "once", "mother", 300},
	{"food", "Diapers and wipes", "monthly", "shared", 80},
	{"food", "Formula or feeding supplies", "monthly", "mother", 100},
	{"childcare", "Daycare", "monthly", "shared", 1100},
	{"leave", "Income lost on unpaid leave", "once", "partner", 4000},
	{"health", "Baby checkups and vaccines (copays)", "once", "shared", 300},
}

// A toddler or preschooler: running costs, not baby gear.
var childBudget = []budgetSeed{
	{"childcare", "Preschool tuition", "monthly", "shared", 1250},
	{"childcare", "After-school care", "monthly", "partner", 300},
	{"food", "Diapers and snacks", "monthly", "shared", 120},
	{"health", "Checkups, vaccines and copays", "once", "shared", 250},
	{"equipment", "Clothes and shoes", "monthly", "mother", 60},
	{"other", "Birthday party", "once", "shared", 200},
}

type optionSeed struct {
	name, kind, status, contact, notes string
	dollars                            int64 // monthly; 0 = unknown
	deadlineDays                       int   // days from today; 0 = none
	waitlist                           int32
}

var daycareOptions = []optionSeed{
	{"Little Oaks Daycare", "center", "waitlisted", "front desk, 555-0142", "Toured on a Tuesday, lots of light. Infant room has a 2-year waitlist.", 1350, 9, 14},
	{"Maple Street Home Daycare", "home_based", "toured", "Ms. Alvarez, 555-0177", "Six children, one extra helper. Cheaper, closer to the train.", 950, 21, 0},
}

// seedMoney gives every demo family a filled budget and two daycare inquiries.
func seedMoney(ctx context.Context, q *store.Queries, fam uuid.UUID, stage string, today time.Time) error {
	lines := babyBudget
	if stage == "toddler" || stage == "preschool" || stage == "school_age" {
		lines = childBudget
	}
	for _, b := range lines {
		if _, err := q.CreateBudgetItem(ctx, store.CreateBudgetItemParams{
			FamilyID: fam, Category: b.category, Name: b.name, AmountCents: b.dollars * 100, Cadence: b.cadence, Payer: b.payer,
		}); err != nil {
			return err
		}
	}
	if _, err := q.UpsertBirthCostPlan(ctx, store.UpsertBirthCostPlanParams{
		FamilyID: fam, DeductibleCents: 300_000, OutOfPocketMaxCents: 750_000, CoinsurancePercent: 20, UpdatedAt: today,
	}); err != nil {
		return err
	}
	for _, o := range daycareOptions {
		cost := o.dollars * 100
		p := store.CreateChildcareOptionParams{
			FamilyID: fam, Name: o.name, Kind: o.kind, Status: o.status, MonthlyCostCents: pgtype.Int8{Int64: cost, Valid: true},
			Contact: &o.contact, Notes: &o.notes,
		}
		if o.deadlineDays != 0 {
			d := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, o.deadlineDays)
			p.ApplicationDeadline = &d
		}
		if o.waitlist != 0 {
			p.WaitlistPosition = pgtype.Int4{Int32: o.waitlist, Valid: true}
		}
		if _, err := q.CreateChildcareOption(ctx, p); err != nil {
			return err
		}
	}
	return nil
}
