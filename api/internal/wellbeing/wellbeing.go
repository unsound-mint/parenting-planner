// Package wellbeing owns mood check-ins (and later the diary).
//
// REFERENCE MODULE: this is the pattern every sensitive-data module copies.
// See api/AGENTS.md, "Recipe: add a module". The parts to copy:
//   - functions take the store, the family id and the acting member id;
//   - writes and lists run in one transaction together with access.Audit;
//   - list queries use the *VisibleToParent SQL, which mirrors access.CanParentRead;
//   - input validation is already done by the OpenAPI middleware, so only
//     business rules that the contract cannot express live here.
package wellbeing

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityMoodCheckin = "mood_checkin"

// ListWindow is how far back ListMoodCheckins looks.
const ListWindow = 30 * 24 * time.Hour

type NewMoodCheckin struct {
	Mood       int16
	Energy     int16
	SleepHours float64
	Note       *string
	Visibility access.Visibility
	RecordedAt time.Time
}

func CreateMoodCheckin(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewMoodCheckin) (store.MoodCheckin, error) {
	var out store.MoodCheckin
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		c, err := q.CreateMoodCheckin(ctx, store.CreateMoodCheckinParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility),
			RecordedAt: in.RecordedAt, Mood: in.Mood, Energy: in.Energy, SleepHours: in.SleepHours, Note: in.Note,
		})
		if err != nil {
			return err
		}
		out = c
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityMoodCheckin, c.ID.String())
	})
	return out, err
}

func ListMoodCheckins(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]store.MoodCheckin, error) {
	var out []store.MoodCheckin
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListMoodCheckinsVisibleToParent(ctx, store.ListMoodCheckinsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-ListWindow),
		})
		if err != nil {
			return err
		}
		out = rows
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityMoodCheckin, "")
	})
	return out, err
}
