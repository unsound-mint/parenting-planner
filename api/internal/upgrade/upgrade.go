// Package upgrade records which paid tier a family asked for. There is no
// billing: an intent never changes the family's tier, it only shows as
// "upgrade requested". The data is family-wide, not one parent's, so it has
// no visibility and is not audited.
package upgrade

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Request stores the family's upgrade intent, replacing any earlier one.
func Request(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, tier string, now time.Time) (store.UpgradeIntent, error) {
	return store.New(pool).UpsertUpgradeIntent(ctx, store.UpsertUpgradeIntentParams{
		FamilyID: familyID, Tier: tier, RequestedAt: now,
	})
}

// Current returns the family's upgrade intent; ok is false if there is none.
func Current(ctx context.Context, q *store.Queries, familyID uuid.UUID) (in store.UpgradeIntent, ok bool, err error) {
	in, err = q.GetUpgradeIntent(ctx, familyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return in, false, nil
	}
	return in, err == nil, err
}
