package family

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	// ErrLossNotPregnant: support can only be turned on for a family in the pregnancy stage.
	ErrLossNotPregnant = errors.New("the family is not pregnant")
	// ErrLossDateInFuture: the date of the loss cannot be in the future.
	ErrLossDateInFuture = errors.New("the date cannot be in the future")
	// ErrNoLoss: support is not on, so there is nothing to undo.
	ErrNoLoss = errors.New("pregnancy loss support is not on")
)

const entityLoss = "pregnancy_loss"

// RecordLoss turns pregnancy loss support on in one transaction: the stage becomes
// planning, the due date is cleared (so the week, the card and the pregnancy rules
// stop on their own) and the replaced values are kept for an undo.
func RecordLoss(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, occurredOn *time.Time, today, now time.Time) (store.Family, error) {
	if occurredOn != nil && occurredOn.After(today) {
		return store.Family{}, ErrLossDateInFuture
	}
	var out store.Family
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		f, err := q.RecordPregnancyLoss(ctx, store.RecordPregnancyLossParams{
			ID: familyID, RecordedAt: pgtype.Timestamptz{Time: now, Valid: true}, OccurredOn: occurredOn,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrLossNotPregnant
		}
		if err != nil {
			return err
		}
		out = f
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityLoss, familyID.String())
	})
	return out, err
}

// UndoLoss turns support off and restores the stage and due date it replaced.
func UndoLoss(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID) (store.Family, error) {
	var out store.Family
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		f, err := q.RestorePregnancyLoss(ctx, familyID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoLoss
		}
		if err != nil {
			return err
		}
		out = f
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entityLoss, familyID.String())
	})
	return out, err
}
