package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Drawn portraits, so the flipbook plays on stage without an upload and the
// public repo holds no photo of a real child. The rows have no image; the web
// draws each one in the illustration style from its week or month. The web's
// preview mock (web/src/lib/mock/fixtures/portraits.ts) lists the same slots.

// bumpWeeks seeds a bump drawing for each pregnancy week, dated as if the
// pregnancy ends at 40 weeks on end (the due date, or the birth).
func bumpWeeks(ctx context.Context, q *store.Queries, fam uuid.UUID, end time.Time, weeks ...int) error {
	for _, w := range weeks {
		if _, err := q.CreatePortrait(ctx, store.CreatePortraitParams{
			FamilyID: fam, Week: pgtype.Int2{Int16: int16(w), Valid: true}, Kind: "illustration",
			CreatedAt: end.AddDate(0, 0, -(40-w)*7).Add(18 * time.Hour),
		}); err != nil {
			return err
		}
	}
	return nil
}

// childMonths seeds a drawing of the child at each age in months.
func childMonths(ctx context.Context, q *store.Queries, fam, child uuid.UUID, born time.Time, months ...int) error {
	for _, m := range months {
		if _, err := q.CreatePortrait(ctx, store.CreatePortraitParams{
			FamilyID: fam, ChildID: uuid.NullUUID{UUID: child, Valid: true}, Month: pgtype.Int2{Int16: int16(m), Valid: true},
			Kind: "illustration", CreatedAt: born.AddDate(0, m, 0).Add(18 * time.Hour),
		}); err != nil {
			return err
		}
	}
	return nil
}
