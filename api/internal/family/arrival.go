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

var (
	// ErrNotPregnant: "Baby is home" only applies to a family in the pregnancy stage.
	ErrNotPregnant = errors.New("the family is not pregnant")
	// ErrBadBirthDate: the birth date must be today or up to 30 days ago.
	ErrBadBirthDate = errors.New("birth date must be today or up to 30 days ago")
)

// BabyIsHome adds the child and moves the family to postpartum in one
// transaction. The due date stays stored; the gestational week is simply no
// longer returned. Everything that depends on the stage (pregnancy card,
// birth prep, pregnancy plan rules) is computed on read, so it follows.
func BabyIsHome(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, name string, born, today time.Time) (store.Family, error) {
	if born.After(today) || born.Before(today.AddDate(0, 0, -30)) {
		return store.Family{}, ErrBadBirthDate
	}
	var out store.Family
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cur, err := q.GetFamilyForUpdate(ctx, familyID)
		if err != nil {
			return err
		}
		if cur.Stage != "pregnancy" {
			return ErrNotPregnant
		}
		if _, err := q.CreateChild(ctx, store.CreateChildParams{FamilyID: familyID, Name: name, BirthDate: born}); err != nil {
			return err
		}
		// Every agreed shift becomes active today, so it shows in everyone's calendar and Today.
		if err := q.ActivateAgreedShifts(ctx, store.ActivateAgreedShiftsParams{FamilyID: familyID, StartsOn: &today}); err != nil {
			return err
		}
		out, err = q.UpdateFamilyStage(ctx, store.UpdateFamilyStageParams{ID: familyID, Stage: "postpartum", DueDate: cur.DueDate})
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityFamily, familyID.String())
	})
	return out, err
}
