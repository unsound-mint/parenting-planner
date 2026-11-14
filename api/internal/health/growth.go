package health

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

const entityGrowth = "growth_measurement"

// ErrNoMeasurement: the growth measurement is not in this family.
var ErrNoMeasurement = errors.New("no such growth measurement")

// Growth is one visit's weight, length and (when measured) head circumference.
type Growth struct {
	MeasuredOn time.Time
	WeightKg   float64
	HeightCm   float64
	HeadCm     *float64
}

// LogGrowth records a measurement for a child of the family.
func LogGrowth(ctx context.Context, pool *pgxpool.Pool, familyID, actor, childID uuid.UUID, today time.Time, in Growth) (store.GrowthMeasurement, error) {
	if err := checkDate(in.MeasuredOn, today); err != nil {
		return store.GrowthMeasurement{}, err
	}
	var out store.GrowthMeasurement
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := checkSubject(ctx, q, familyID, Subject{ChildID: &childID}); err != nil {
			return err
		}
		var err error
		out, err = q.CreateGrowthMeasurement(ctx, store.CreateGrowthMeasurementParams{
			FamilyID: familyID, ChildID: childID, MeasuredOn: in.MeasuredOn, WeightKg: in.WeightKg, HeightCm: in.HeightCm, HeadCm: in.HeadCm,
		})
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityGrowth, out.ID.String())
	})
	return out, err
}

// UpdateGrowth corrects a measurement; the child stays.
func UpdateGrowth(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID, today time.Time, in Growth) (store.GrowthMeasurement, error) {
	if err := checkDate(in.MeasuredOn, today); err != nil {
		return store.GrowthMeasurement{}, err
	}
	var out store.GrowthMeasurement
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		out, err = q.UpdateGrowthMeasurement(ctx, store.UpdateGrowthMeasurementParams{
			ID: id, FamilyID: familyID, MeasuredOn: in.MeasuredOn, WeightKg: in.WeightKg, HeightCm: in.HeightCm, HeadCm: in.HeadCm,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoMeasurement
		}
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityGrowth, id.String())
	})
	return out, err
}

// DeleteGrowth removes a measurement.
func DeleteGrowth(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.DeleteGrowthMeasurement(ctx, store.DeleteGrowthMeasurementParams{ID: id, FamilyID: familyID})
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNoMeasurement
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entityGrowth, id.String())
	})
}
