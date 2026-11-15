package milestones

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "child_milestone"

var ErrNotFound = errors.New("child or milestone unavailable")

// ErrBadDate is a day after today or before the child was born.
var ErrBadDate = errors.New("observed day out of range")

// Observation is one ticked milestone with the day it was seen.
type Observation struct {
	Item       Item
	AgeMonths  int
	ObservedOn time.Time
}

func childChecklist(ctx context.Context, q *store.Queries, family, child uuid.UUID, today time.Time) (int, []Item, time.Time, error) {
	c, err := q.GetMilestoneChild(ctx, store.GetMilestoneChildParams{FamilyID: family, ID: child})
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, time.Time{}, ErrNotFound
	}
	if err != nil {
		return 0, nil, time.Time{}, err
	}
	age, items := Checklist((rules.ChildFacts{BirthDate: c.BirthDate}).AgeMonths(today))
	return age, items, c.BirthDate, nil
}

// Read returns the checklist for the child's age, the days its items were seen,
// and every observation from any checklist age, newest first (the timeline).
func Read(ctx context.Context, pool *pgxpool.Pool, family, parent, child uuid.UUID, today time.Time) (age int, items []Item, observed map[string]time.Time, recorded []Observation, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var e error
		age, items, _, e = childChecklist(ctx, q, family, child, today)
		if e != nil {
			return e
		}
		rows, e := q.ListChildMilestoneObservations(ctx, store.ListChildMilestoneObservationsParams{FamilyID: family, ChildID: child})
		if e != nil {
			return e
		}
		observed = make(map[string]time.Time, len(rows))
		recorded = make([]Observation, 0, len(rows))
		for _, row := range rows {
			observed[row.MilestoneID] = row.ObservedOn
			// An id the catalog no longer has stays stored but is not shown.
			if item, itemAge, ok := Find(row.MilestoneID); ok {
				recorded = append(recorded, Observation{Item: item, AgeMonths: itemAge, ObservedOn: row.ObservedOn})
			}
		}
		return access.Audit(ctx, q, family, parent, access.ActionRead, entity, child.String())
	})
	return
}

// Set ticks or unticks a milestone from the child's current or an earlier
// checklist. on, when set, is the day it was seen and moves an existing tick to
// that day; without it a new tick is today and an existing one keeps its day.
func Set(ctx context.Context, pool *pgxpool.Pool, family, parent, child uuid.UUID, id string, observe bool, on *time.Time, today time.Time) (item Item, day *time.Time, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := q.LockMilestoneChild(ctx, store.LockMilestoneChildParams{FamilyID: family, ID: child}); err != nil {
			return err
		}
		age, _, born, err := childChecklist(ctx, q, family, child, today)
		if err != nil {
			return err
		}
		found, itemAge, ok := Find(id)
		if !ok || itemAge > age {
			return ErrNotFound
		}
		item = found
		if observe {
			by := uuid.NullUUID{UUID: parent, Valid: true}
			if on != nil {
				if on.After(today) || on.Before(born) {
					return ErrBadDate
				}
				err = q.SetChildMilestoneObservedOn(ctx, store.SetChildMilestoneObservedOnParams{
					FamilyID: family, ChildID: child, MilestoneID: id, ObservedOn: *on, SetByMemberID: by,
				})
			} else {
				err = q.AddChildMilestoneObservation(ctx, store.AddChildMilestoneObservationParams{
					FamilyID: family, ChildID: child, MilestoneID: id, ObservedOn: today, SetByMemberID: by,
				})
			}
			if err != nil {
				return err
			}
			saved, err := q.GetChildMilestoneObservation(ctx, store.GetChildMilestoneObservationParams{FamilyID: family, ChildID: child, MilestoneID: id})
			if err != nil {
				return err
			}
			day = &saved
			return access.Audit(ctx, q, family, parent, access.ActionUpdate, entity, child.String())
		}
		count, err := q.RemoveChildMilestoneObservation(ctx, store.RemoveChildMilestoneObservationParams{FamilyID: family, ChildID: child, MilestoneID: id})
		if err != nil || count == 0 {
			return err
		}
		return access.Audit(ctx, q, family, parent, access.ActionDelete, entity, child.String())
	})
	return
}
