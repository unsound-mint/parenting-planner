// Package childcare keeps the family's childcare options: daycares, nannies
// and family care, with where each one stands. The data is family-wide, not
// one parent's, so it has no visibility and is not audited (like
// internal/upgrade). An offered option with a decide-by date feeds the plan
// through plan.LoadFacts.
package childcare

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// ErrNotFound means no option with that id in this family.
var ErrNotFound = errors.New("childcare: no such option in this family")

// Input is one option as the parents enter it. Nil fields are empty.
type Input struct {
	Name             string
	Kind             string
	Contact          *string
	MonthlyCost      *int
	Status           string
	WaitlistPosition *int
	AppliedOn        *time.Time
	DecideBy         *time.Time
	Notes            *string
}

func int4(v *int) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*v), Valid: true}
}

// List returns the family's options, newest first.
func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) ([]store.ChildcareOption, error) {
	return store.New(pool).ListChildcareOptions(ctx, familyID)
}

// Get returns one option of the family, or ErrNotFound.
func Get(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID) (store.ChildcareOption, error) {
	o, err := store.New(pool).GetChildcareOption(ctx, store.GetChildcareOptionParams{ID: id, FamilyID: familyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrNotFound
	}
	return o, err
}

// Create adds an option to the family's list.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, in Input, now time.Time) (store.ChildcareOption, error) {
	return store.New(pool).CreateChildcareOption(ctx, store.CreateChildcareOptionParams{
		FamilyID: familyID, Name: in.Name, Kind: in.Kind, Contact: in.Contact, MonthlyCost: int4(in.MonthlyCost),
		Status: in.Status, WaitlistPosition: int4(in.WaitlistPosition), AppliedOn: in.AppliedOn, DecideBy: in.DecideBy,
		Notes: in.Notes, Now: now,
	})
}

// Update replaces every field of an option with in, or returns ErrNotFound.
func Update(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID, in Input, now time.Time) (store.ChildcareOption, error) {
	o, err := store.New(pool).UpdateChildcareOption(ctx, store.UpdateChildcareOptionParams{
		ID: id, FamilyID: familyID, Name: in.Name, Kind: in.Kind, Contact: in.Contact, MonthlyCost: int4(in.MonthlyCost),
		Status: in.Status, WaitlistPosition: int4(in.WaitlistPosition), AppliedOn: in.AppliedOn, DecideBy: in.DecideBy,
		Notes: in.Notes, Now: now,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrNotFound
	}
	return o, err
}

// Delete removes an option, or returns ErrNotFound.
func Delete(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID) error {
	n, err := store.New(pool).DeleteChildcareOption(ctx, store.DeleteChildcareOptionParams{ID: id, FamilyID: familyID})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
