// Package tasks owns family to-dos and handing them between parents.
//
// A task always has one assignee. Offering it to the other parent sets a
// pending assignee; ownership moves only when that parent accepts. Tasks are
// shared family data, not one parent's private records, so they have no
// visibility and are not audited (see api/AGENTS.md, "Audit").
package tasks

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	// ErrNoTask: no task with this id in the family.
	ErrNoTask = errors.New("no such task in this family")
	// ErrNoTarget: the parent the task is offered to is not in the family.
	ErrNoTarget = errors.New("no such parent in this family")
	// ErrNotAssignee: only the current assignee may offer the task, and not to themselves.
	ErrNotAssignee = errors.New("only the assignee can offer this task to the other parent")
	// ErrNotOffered: only the parent the task was offered to may accept or decline.
	ErrNotOffered = errors.New("this task was not offered to you")
)

type NewTask struct {
	Title     string
	DueOn     *time.Time
	CreatedAt time.Time
}

// Create adds a task assigned to the acting parent.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewTask) (store.Task, error) {
	return store.New(pool).CreateTask(ctx, store.CreateTaskParams{
		FamilyID: familyID, Title: in.Title, DueOn: in.DueOn, AssigneeMemberID: actor, CreatedAt: in.CreatedAt,
	})
}

func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) ([]store.Task, error) {
	return store.New(pool).ListTasks(ctx, familyID)
}

// Propose offers a task to another parent. The assignee does not change.
func Propose(ctx context.Context, pool *pgxpool.Pool, familyID, actor, taskID, to uuid.UUID) (store.Task, error) {
	var out store.Task
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.GetTask(ctx, store.GetTaskParams{ID: taskID, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
			return ErrNoTask
		} else if err != nil {
			return err
		}
		if _, err := q.GetMember(ctx, store.GetMemberParams{ID: to, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
			return ErrNoTarget
		} else if err != nil {
			return err
		}
		if to == actor {
			return ErrNotAssignee
		}
		t, err := q.ProposeTaskAssignee(ctx, store.ProposeTaskAssigneeParams{
			ToMemberID: uuid.NullUUID{UUID: to, Valid: true}, ID: taskID, FamilyID: familyID, ActorID: actor,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotAssignee
		}
		out = t
		return err
	})
	return out, err
}

// Accept moves the task to the parent it was offered to.
func Accept(ctx context.Context, pool *pgxpool.Pool, familyID, actor, taskID uuid.UUID) (store.Task, error) {
	return answer(ctx, pool, familyID, actor, taskID, true)
}

// Decline keeps the task with its assignee and clears the offer.
func Decline(ctx context.Context, pool *pgxpool.Pool, familyID, actor, taskID uuid.UUID) (store.Task, error) {
	return answer(ctx, pool, familyID, actor, taskID, false)
}

func answer(ctx context.Context, pool *pgxpool.Pool, familyID, actor, taskID uuid.UUID, accept bool) (store.Task, error) {
	var out store.Task
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.GetTask(ctx, store.GetTaskParams{ID: taskID, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
			return ErrNoTask
		} else if err != nil {
			return err
		}
		pending := uuid.NullUUID{UUID: actor, Valid: true}
		var t store.Task
		var err error
		if accept {
			t, err = q.AcceptTaskAssignee(ctx, store.AcceptTaskAssigneeParams{ID: taskID, FamilyID: familyID, ActorID: pending})
		} else {
			t, err = q.DeclineTaskAssignee(ctx, store.DeclineTaskAssigneeParams{ID: taskID, FamilyID: familyID, ActorID: pending})
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotOffered
		}
		out = t
		return err
	})
	return out, err
}
