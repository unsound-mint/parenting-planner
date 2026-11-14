// Package recovery is the mother's own recovery tracker after birth. Built like
// internal/wellbeing: each create, list and change runs in one transaction with
// access.Audit, reads use the *VisibleToParent SQL, and only the author may
// change who can read a check-in.
package recovery

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "recovery_checkin"

// ListWindow is how far back the list looks.
const ListWindow = 30 * 24 * time.Hour

var (
	ErrNoChild   = errors.New("no baby on record yet")
	ErrNoCheckin = errors.New("no such recovery check-in")
)

type New struct {
	Visibility                            access.Visibility
	RecordedAt                            time.Time
	Bleeding, Wound, Breasts, PelvicFloor string
	Pain                                  int16
	SleepHours                            float32
	Mood                                  *int16
	WarningSigns                          []string
	Note                                  *string
}

// Create stores a check-in for the mother. It needs a baby on record.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in New) (store.RecoveryCheckin, error) {
	var out store.RecoveryCheckin
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		kids, err := q.ListChildren(ctx, familyID)
		if err != nil {
			return err
		}
		if len(kids) == 0 {
			return ErrNoChild
		}
		signs := in.WarningSigns
		if signs == nil {
			signs = []string{}
		}
		var mood pgtype.Int2
		if in.Mood != nil {
			mood = pgtype.Int2{Int16: *in.Mood, Valid: true}
		}
		c, err := q.CreateRecoveryCheckin(ctx, store.CreateRecoveryCheckinParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility), RecordedAt: in.RecordedAt,
			Bleeding: in.Bleeding, Pain: in.Pain, Wound: in.Wound, Breasts: in.Breasts, PelvicFloor: in.PelvicFloor,
			SleepHours: in.SleepHours, Mood: mood, WarningSigns: signs, Note: in.Note,
		})
		if err != nil {
			return err
		}
		out = c
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entity, c.ID.String())
	})
	return out, err
}

func List(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]store.RecoveryCheckin, error) {
	var out []store.RecoveryCheckin
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListRecoveryCheckinsVisibleToParent(ctx, store.ListRecoveryCheckinsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-ListWindow),
		})
		if err != nil {
			return err
		}
		out = rows
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return out, err
}

// SetVisibility lets the author share a check-in with the partner or take it back.
func SetVisibility(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID, v access.Visibility) (store.RecoveryCheckin, error) {
	var out store.RecoveryCheckin
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		c, err := q.UpdateOwnRecoveryCheckinVisibleToParent(ctx, store.UpdateOwnRecoveryCheckinVisibleToParentParams{
			ID: id, FamilyID: familyID, ViewerID: actor, Visibility: string(v),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoCheckin
		}
		if err != nil {
			return err
		}
		out = c
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entity, c.ID.String())
	})
	return out, err
}

// Guidance is the fourth-trimester card for the family's newest baby.
type Guidance struct {
	rules.RecoveryGuidance
	DaysSinceBirth int
	Check          rules.PostnatalCheck
}

func GuidanceFor(ctx context.Context, q *store.Queries, familyID uuid.UUID, today time.Time) (Guidance, error) {
	kids, err := q.ListChildren(ctx, familyID) // oldest first
	if err != nil {
		return Guidance{}, err
	}
	if len(kids) == 0 {
		return Guidance{}, ErrNoChild
	}
	birth := kids[len(kids)-1].BirthDate
	days := int(today.Sub(birth).Hours() / 24)
	if days < 0 {
		return Guidance{}, ErrNoChild
	}
	return Guidance{RecoveryGuidance: rules.FourthTrimester(days), DaysSinceBirth: days, Check: rules.PostnatalCheckWindow(birth, today)}, nil
}
