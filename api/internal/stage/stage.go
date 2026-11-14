// Package stage changes a family's stage and due date, and flips the family to
// "Baby is home". Everything derived from the stage or the due date (weekly
// card, guides, plan rules, paperwork deadlines) is computed on read from the
// stored values, so changing them here is all it takes.
package stage

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrDueDateRequired = errors.New("stage pregnancy needs a due date")
	ErrBadDueDate      = errors.New("due date is out of range")
	ErrNoChild         = errors.New("this stage needs a child")
	ErrNotPregnant     = errors.New("the family is not pregnant")
	ErrBadBirthDate    = errors.New("birth date must be today or up to 30 days ago")
)

// Stages that need a child.
var afterBirth = map[string]bool{"postpartum": true, "infant": true, "toddler": true, "preschool": true, "school_age": true}

// Update is what a parent may change. Nil means "leave as it is".
type Update struct {
	Stage   *string
	DueDate *time.Time
}

// Apply returns the stage and due date a family ends up with, or why it cannot.
// It is pure: the clock and the child count are passed in.
func Apply(stage string, due *time.Time, hasChild bool, in Update, today time.Time) (string, *time.Time, error) {
	newStage, newDue := stage, due
	if in.Stage != nil {
		newStage = *in.Stage
	}
	if in.DueDate != nil {
		newDue = in.DueDate
	}
	switch {
	case newStage == "planning" || newStage == "trying":
		newDue = nil // leaving pregnancy clears the due date
	case newStage == "pregnancy":
		if newDue == nil {
			return "", nil, ErrDueDateRequired
		}
		if newDue.After(today.AddDate(0, 0, 7*42)) || newDue.Before(today.AddDate(0, 0, -14)) {
			return "", nil, ErrBadDueDate
		}
	case afterBirth[newStage] && !hasChild:
		return "", nil, ErrNoChild
	}
	return newStage, newDue, nil
}

// UpdateFamily applies an update in one transaction.
func UpdateFamily(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, in Update, today time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		fam, err := q.GetFamily(ctx, familyID)
		if err != nil {
			return err
		}
		children, err := q.ListChildren(ctx, familyID)
		if err != nil {
			return err
		}
		stage, due, err := Apply(fam.Stage, fam.DueDate, len(children) > 0, in, today)
		if err != nil {
			return err
		}
		_, err = q.UpdateFamilyStage(ctx, store.UpdateFamilyStageParams{ID: familyID, Stage: stage, DueDate: due})
		return err
	})
}

// BabyIsHome adds the child and moves the family to postpartum. The due date
// stays stored; the gestational week is simply no longer shown.
func BabyIsHome(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, name string, born, today time.Time) error {
	if born.After(today) || born.Before(today.AddDate(0, 0, -30)) {
		return ErrBadBirthDate
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		fam, err := q.GetFamily(ctx, familyID)
		if err != nil {
			return err
		}
		if fam.Stage != "pregnancy" {
			return ErrNotPregnant
		}
		if _, err := q.CreateChild(ctx, store.CreateChildParams{FamilyID: familyID, Name: name, BirthDate: born}); err != nil {
			return err
		}
		// Every agreed shift becomes active today, so it shows in everyone's calendar and Today.
		if err := q.ActivateAgreedShifts(ctx, store.ActivateAgreedShiftsParams{FamilyID: familyID, StartsOn: &today}); err != nil {
			return err
		}
		_, err = q.UpdateFamilyStage(ctx, store.UpdateFamilyStageParams{ID: familyID, Stage: "postpartum", DueDate: fam.DueDate})
		return err
	})
}
