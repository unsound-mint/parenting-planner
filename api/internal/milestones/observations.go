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

func childChecklist(ctx context.Context, q *store.Queries, family, child uuid.UUID, today time.Time) (int, []Item, error) {
	c, err := q.GetMilestoneChild(ctx, store.GetMilestoneChildParams{FamilyID: family, ID: child})
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, ErrNotFound
	}
	if err != nil {
		return 0, nil, err
	}
	age, items := Checklist((rules.ChildFacts{BirthDate: c.BirthDate}).AgeMonths(today))
	if age == 0 {
		return 0, nil, ErrNotFound
	}
	return age, items, nil
}

func Read(ctx context.Context, pool *pgxpool.Pool, family, parent, child uuid.UUID, today time.Time) (age int, items []Item, observed map[string]time.Time, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var e error
		age, items, e = childChecklist(ctx, q, family, child, today)
		if e != nil {
			return e
		}
		rows, e := q.ListChildMilestoneObservations(ctx, store.ListChildMilestoneObservationsParams{FamilyID: family, ChildID: child})
		if e != nil {
			return e
		}
		observed = make(map[string]time.Time, len(rows))
		for _, row := range rows {
			observed[row.MilestoneID] = row.ObservedOn
		}
		return access.Audit(ctx, q, family, parent, access.ActionRead, entity, child.String())
	})
	return
}

func Set(ctx context.Context, pool *pgxpool.Pool, family, parent, child uuid.UUID, id string, observe bool, today time.Time) (item Item, day *time.Time, err error) {
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := q.LockMilestoneChild(ctx, store.LockMilestoneChildParams{FamilyID: family, ID: child}); err != nil {
			return err
		}
		_, items, err := childChecklist(ctx, q, family, child, today)
		if err != nil {
			return err
		}
		for _, candidate := range items {
			if candidate.ID == id {
				item = candidate
				break
			}
		}
		if item.ID == "" {
			return ErrNotFound
		}
		if observe {
			err = q.AddChildMilestoneObservation(ctx, store.AddChildMilestoneObservationParams{
				FamilyID: family, ChildID: child, MilestoneID: id, ObservedOn: today,
				SetByMemberID: uuid.NullUUID{UUID: parent, Valid: true},
			})
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
