// Package family changes the family-wide stage and due date. Everything that
// depends on them (gestational week, weekly card, birth prep unlock, content
// filters) is computed on read, so this is the only write.
package family

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityFamily = "family"

var (
	// ErrDueDateRequired: stage pregnancy needs a due date, sent or stored.
	ErrDueDateRequired = errors.New("pregnancy needs a due date")
	// ErrDueDateNotAllowed: planning and trying have no due date.
	ErrDueDateNotAllowed = errors.New("planning and trying families have no due date")
	// ErrDueDateRange: the date is not a plausible due date.
	ErrDueDateRange = errors.New("due date must be within the next 40 weeks, or at most 3 weeks ago")
	// ErrNoChild: stages after birth need a child, added with "Baby is home".
	ErrNoChild = errors.New("this stage needs a child")
)

// Change is the requested update; nil fields stay as stored.
type Change struct {
	Stage   *string
	DueDate *time.Time
}

func afterBirth(stage string) bool {
	switch stage {
	case "postpartum", "infant", "toddler", "preschool", "school_age":
		return true
	}
	return false
}

// Update applies c and audits it in one transaction. today is a UTC date.
func Update(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, c Change, today time.Time) (store.Family, error) {
	var out store.Family
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cur, err := q.GetFamilyForUpdate(ctx, familyID)
		if err != nil {
			return err
		}
		stage, due := cur.Stage, cur.DueDate
		if c.Stage != nil {
			stage = *c.Stage
		}
		if c.DueDate != nil {
			due = c.DueDate
		}
		switch {
		case stage == "pregnancy":
			if due == nil {
				return ErrDueDateRequired
			}
		case stage == "planning" || stage == "trying":
			if c.DueDate != nil {
				return ErrDueDateNotAllowed
			}
			due = nil
		}
		if c.DueDate != nil && (c.DueDate.Before(today.AddDate(0, 0, -21)) || c.DueDate.After(today.AddDate(0, 0, 280))) {
			return ErrDueDateRange
		}
		if afterBirth(stage) {
			kids, err := q.ListChildren(ctx, familyID)
			if err != nil {
				return err
			}
			if len(kids) == 0 {
				return ErrNoChild
			}
		}
		out, err = q.UpdateFamilyStage(ctx, store.UpdateFamilyStageParams{ID: familyID, Stage: stage, DueDate: due})
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityFamily, familyID.String())
	})
	return out, err
}
