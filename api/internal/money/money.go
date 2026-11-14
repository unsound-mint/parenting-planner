// Package money owns the shared baby budget, the birth cost plan and the childcare list.
// Both parents read and edit all of it; the httpapi handlers answer 404 to caregivers, so
// nothing here knows about roles. Every query filters by family id.
package money

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var ErrNotFound = errors.New("not found in this family")

var (
	Categories = []string{"pregnancy_care", "delivery", "equipment", "childcare", "leave", "food", "health", "other"}
	Payers     = []string{"mother", "partner", "shared"}
)

type Total struct{ OneTime, Monthly, FirstYear int64 }

type CategoryTotal struct {
	Category string
	Total
}

type PayerTotal struct {
	Payer string
	Total
}

type Budget struct {
	Items       []store.BudgetItem
	Total       Total
	ByCategory  []CategoryTotal
	ByPayer     []PayerTotal
	Suggestions []Suggestion
}

type NewItem struct {
	Category, Name, Cadence, Payer string
	AmountCents                    int64
}

func add(t *Total, it store.BudgetItem) {
	if it.Cadence == "monthly" {
		t.Monthly += it.AmountCents
		t.FirstYear += it.AmountCents * 12
	} else {
		t.OneTime += it.AmountCents
		t.FirstYear += it.AmountCents
	}
}

// Summarize computes the totals. A monthly item counts twelve times in FirstYear.
func Summarize(items []store.BudgetItem) Budget {
	b := Budget{Items: items}
	byCat := map[string]*Total{}
	byPayer := map[string]*Total{}
	for _, p := range Payers {
		byPayer[p] = &Total{}
	}
	for _, it := range items {
		add(&b.Total, it)
		if byCat[it.Category] == nil {
			byCat[it.Category] = &Total{}
		}
		add(byCat[it.Category], it)
		add(byPayer[it.Payer], it)
	}
	for c, t := range byCat {
		b.ByCategory = append(b.ByCategory, CategoryTotal{c, *t})
	}
	sort.Slice(b.ByCategory, func(i, j int) bool {
		a, c := b.ByCategory[i], b.ByCategory[j]
		if a.FirstYear != c.FirstYear {
			return a.FirstYear > c.FirstYear
		}
		return a.Category < c.Category
	})
	for _, p := range Payers {
		b.ByPayer = append(b.ByPayer, PayerTotal{p, *byPayer[p]})
	}
	b.Suggestions = suggestionsFor(items)
	return b
}

func GetBudget(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) (Budget, error) {
	items, err := store.New(pool).ListBudgetItems(ctx, familyID)
	if err != nil {
		return Budget{}, err
	}
	return Summarize(items), nil
}

func CreateItem(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewItem) (store.BudgetItem, error) {
	return store.New(pool).CreateBudgetItem(ctx, store.CreateBudgetItemParams{
		FamilyID: familyID, Category: in.Category, Name: strings.TrimSpace(in.Name), AmountCents: in.AmountCents,
		Cadence: in.Cadence, Payer: in.Payer, CreatedBy: uuid.NullUUID{UUID: actor, Valid: true},
	})
}

func UpdateItem(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID, in NewItem) (store.BudgetItem, error) {
	it, err := store.New(pool).UpdateBudgetItem(ctx, store.UpdateBudgetItemParams{
		ID: id, FamilyID: familyID, Category: in.Category, Name: strings.TrimSpace(in.Name), AmountCents: in.AmountCents,
		Cadence: in.Cadence, Payer: in.Payer,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return it, ErrNotFound
	}
	return it, err
}

func DeleteItem(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID) error {
	n, err := store.New(pool).DeleteBudgetItem(ctx, store.DeleteBudgetItemParams{ID: id, FamilyID: familyID})
	if err == nil && n == 0 {
		return ErrNotFound
	}
	return err
}

// GetCostInput returns the saved plan numbers, or nil when no parent has saved them.
func GetCostInput(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) (*CostInput, error) {
	row, err := store.New(pool).GetBirthCostPlan(ctx, familyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &CostInput{row.DeductibleCents, row.OutOfPocketMaxCents, int64(row.CoinsurancePercent), row.AlreadyPaidCents}, nil
}

func SaveCostInput(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in CostInput, now time.Time) error {
	_, err := store.New(pool).UpsertBirthCostPlan(ctx, store.UpsertBirthCostPlanParams{
		FamilyID: familyID, DeductibleCents: in.DeductibleCents, OutOfPocketMaxCents: in.OutOfPocketMaxCents,
		CoinsurancePercent: int16(in.CoinsurancePercent), AlreadyPaidCents: in.AlreadyPaidCents,
		UpdatedBy: uuid.NullUUID{UUID: actor, Valid: true}, UpdatedAt: now,
	})
	return err
}

type NewOption struct {
	Name, Kind, Status  string
	MonthlyCostCents    *int64
	ApplicationDeadline *time.Time
	WaitlistPosition    *int32
	Contact, Notes      *string
}

func int8p(v *int64) pgtype.Int8 {
	if v == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *v, Valid: true}
}

func int4p(v *int32) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *v, Valid: true}
}

func ListOptions(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) ([]store.ChildcareOption, error) {
	return store.New(pool).ListChildcareOptions(ctx, familyID)
}

func CreateOption(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewOption) (store.ChildcareOption, error) {
	return store.New(pool).CreateChildcareOption(ctx, store.CreateChildcareOptionParams{
		FamilyID: familyID, Name: strings.TrimSpace(in.Name), Kind: in.Kind, Status: in.Status, MonthlyCostCents: int8p(in.MonthlyCostCents),
		ApplicationDeadline: in.ApplicationDeadline, WaitlistPosition: int4p(in.WaitlistPosition), Contact: in.Contact, Notes: in.Notes,
		CreatedBy: uuid.NullUUID{UUID: actor, Valid: true},
	})
}

func UpdateOption(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID, in NewOption) (store.ChildcareOption, error) {
	o, err := store.New(pool).UpdateChildcareOption(ctx, store.UpdateChildcareOptionParams{
		ID: id, FamilyID: familyID, Name: strings.TrimSpace(in.Name), Kind: in.Kind, Status: in.Status, MonthlyCostCents: int8p(in.MonthlyCostCents),
		ApplicationDeadline: in.ApplicationDeadline, WaitlistPosition: int4p(in.WaitlistPosition), Contact: in.Contact, Notes: in.Notes,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrNotFound
	}
	return o, err
}

func DeleteOption(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID) error {
	n, err := store.New(pool).DeleteChildcareOption(ctx, store.DeleteChildcareOptionParams{ID: id, FamilyID: familyID})
	if err == nil && n == 0 {
		return ErrNotFound
	}
	return err
}

// OpenStatuses are the options whose application deadline still matters.
func deadlineOpen(status string) bool {
	return status == "inquiring" || status == "toured" || status == "waitlisted"
}

// DeadlineEvents are the options with an open application deadline in [from, to), for the calendar.
func DeadlineEvents(ctx context.Context, q *store.Queries, familyID uuid.UUID, from, to time.Time) ([]store.ChildcareOption, error) {
	rows, err := q.ListChildcareOptions(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var out []store.ChildcareOption
	for _, o := range rows {
		if o.ApplicationDeadline == nil || !deadlineOpen(o.Status) {
			continue
		}
		d := *o.ApplicationDeadline
		day := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		if !day.Before(from) && day.Before(to) {
			out = append(out, o)
		}
	}
	return out, nil
}
