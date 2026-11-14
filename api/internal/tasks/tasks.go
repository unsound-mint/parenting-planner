// Package tasks is the family's shared plan: free tasks, the seeded US
// paperwork checklist and the hospital bag lists, all with one owner each.
// Handing a task to someone else needs their acceptance; ownership moves only
// on accept. Deadlines of paperwork are computed on read from the due date or
// the birth date, so moving the due date moves them.
package tasks

import (
	"context"
	"errors"
	"slices"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrNotFound     = errors.New("no such task")
	ErrForbidden    = errors.New("only the assignee or a parent may change this task")
	ErrNotAssignee  = errors.New("only the assignee can offer the task")
	ErrInvalidOffer = errors.New("a task cannot be offered to its own assignee")
	ErrBadAssignee  = errors.New("the task can be offered to a parent or to a caregiver with family_plan")
	ErrNotOfferedTo = errors.New("the task was not offered to you")
	ErrNoOffer      = errors.New("the task has no open offer")
	ErrBadBag       = errors.New("a hospital bag item needs bag, and only a hospital bag item has one")
)

// Person is whoever acts.
type Person struct {
	ID          uuid.UUID
	Role        string
	Permissions []string
}

func (p Person) IsParent() bool { return p.Role == "mother" || p.Role == "partner" }

// CanUse: parents always, a caregiver with family_plan.
func (p Person) CanUse() bool { return p.IsParent() || slices.Contains(p.Permissions, "family_plan") }

type Input struct {
	Kind   string
	Title  string
	Detail *string
	DueOn  *time.Time
	Bag    *string
}

func publish(ctx context.Context, q *store.Queries, familyID uuid.UUID, actor, taskID uuid.UUID, now time.Time) error {
	return live.Publish(ctx, q, familyID, live.Event{Kind: live.Task, EntityID: taskID.String(), Actor: actor, NeedsPermission: "family_plan"}, now)
}

// Create adds a task owned by the acting person.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, in Input, now time.Time) (store.Task, error) {
	if (in.Kind == "hospital_bag") != (in.Bag != nil) {
		return store.Task{}, ErrBadBag
	}
	var out store.Task
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		out, err = q.CreateTask(ctx, store.CreateTaskParams{
			FamilyID: familyID, Kind: in.Kind, Title: in.Title, Detail: in.Detail, DueOn: in.DueOn, Bag: in.Bag,
			AssigneeMemberID: p.ID, CreatedByMemberID: p.ID,
		})
		if err != nil {
			return err
		}
		return publish(ctx, q, familyID, p.ID, out.ID, now)
	})
	return out, err
}

// Anchors are the dates deadlines count from.
type Anchors struct {
	DueDate   *time.Time
	BirthDate *time.Time // the first child's birth date
}

// Deadline is a task's resolved due date. Offset is set only when the deadline
// is computed from a known anchor; it is nil for a plain date and while a
// birth-date deadline is still counted from the due date.
type Deadline struct {
	On     *time.Time
	Anchor *string
	Offset *int
}

// Resolve computes the deadline of a task from the family's dates.
func Resolve(t store.Task, a Anchors) Deadline {
	if t.DueAnchor == nil || !t.DueOffsetDays.Valid {
		return Deadline{On: t.DueOn}
	}
	offset := int(t.DueOffsetDays.Int32)
	anchor := *t.DueAnchor
	d := Deadline{Anchor: &anchor}
	switch {
	case anchor == "birth_date" && a.BirthDate != nil:
		on := a.BirthDate.AddDate(0, 0, offset)
		d.On, d.Offset = &on, &offset
	case anchor == "birth_date" && a.DueDate != nil:
		on := a.DueDate.AddDate(0, 0, offset) // an estimate until the baby is born
		d.On = &on
	case anchor == "due_date" && a.DueDate != nil:
		on := a.DueDate.AddDate(0, 0, offset)
		d.On, d.Offset = &on, &offset
	}
	return d
}

// Item is a task with its resolved deadline.
type Item struct {
	store.Task
	Deadline Deadline
}

// LoadAnchors reads the family's due date and the first child's birth date.
func LoadAnchors(ctx context.Context, q *store.Queries, familyID uuid.UUID) (Anchors, bool, error) {
	fam, err := q.GetFamily(ctx, familyID)
	if err != nil {
		return Anchors{}, false, err
	}
	kids, err := q.ListChildren(ctx, familyID)
	if err != nil {
		return Anchors{}, false, err
	}
	a := Anchors{DueDate: fam.DueDate}
	if len(kids) > 0 {
		a.BirthDate = &kids[0].BirthDate // oldest first
	}
	return a, len(kids) > 0, nil
}

// List returns the family's tasks, soonest due first and undated last.
// Hospital bag items are not returned once the baby is home.
func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, kind *string) ([]Item, error) {
	return ListWith(ctx, store.New(pool), familyID, kind)
}

// ListWith is List on an open transaction or pool.
func ListWith(ctx context.Context, q *store.Queries, familyID uuid.UUID, kind *string) ([]Item, error) {
	a, babyHome, err := LoadAnchors(ctx, q, familyID)
	if err != nil {
		return nil, err
	}
	rows, err := q.ListTasks(ctx, store.ListTasksParams{FamilyID: familyID, Kind: kind})
	if err != nil {
		return nil, err
	}
	out := make([]Item, 0, len(rows))
	for _, r := range rows {
		if babyHome && r.Kind == "hospital_bag" {
			continue
		}
		out = append(out, Item{Task: r, Deadline: Resolve(r, a)})
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i].Deadline.On, out[j].Deadline.On
		switch {
		case a == nil:
			return false
		case b == nil:
			return true
		}
		return a.Before(*b)
	})
	return out, nil
}

func lock(ctx context.Context, q *store.Queries, familyID, id uuid.UUID) (store.Task, error) {
	t, err := q.GetTaskForUpdate(ctx, store.GetTaskForUpdateParams{ID: id, FamilyID: familyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}

// SetDone ticks or unticks a task. The assignee or either parent may.
func SetDone(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id uuid.UUID, done bool, now time.Time) (store.Task, error) {
	var out store.Task
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		t, err := lock(ctx, q, familyID, id)
		if err != nil {
			return err
		}
		if !p.IsParent() && t.AssigneeMemberID != p.ID {
			return ErrForbidden
		}
		var at pgtype.Timestamptz
		var by uuid.NullUUID
		if done {
			at, by = pgtype.Timestamptz{Time: now, Valid: true}, uuid.NullUUID{UUID: p.ID, Valid: true}
		}
		out, err = q.SetTaskDone(ctx, store.SetTaskDoneParams{ID: id, FamilyID: familyID, Done: done, DoneAt: at, DoneByMemberID: by})
		if err != nil {
			return err
		}
		return publish(ctx, q, familyID, p.ID, id, now)
	})
	return out, err
}

// Propose offers a task to someone else. The task keeps its assignee until they accept.
func Propose(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id, to uuid.UUID, now time.Time) (store.Task, error) {
	var out store.Task
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		t, err := lock(ctx, q, familyID, id)
		if err != nil {
			return err
		}
		if t.AssigneeMemberID != p.ID {
			return ErrNotAssignee
		}
		if to == p.ID {
			return ErrInvalidOffer
		}
		target, err := q.GetPerson(ctx, store.GetPersonParams{ID: to, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrBadAssignee
		}
		if err != nil {
			return err
		}
		if !(Person{ID: target.ID, Role: target.Role, Permissions: target.Permissions}).CanUse() {
			return ErrBadAssignee
		}
		out, err = q.SetTaskPendingAssignee(ctx, store.SetTaskPendingAssigneeParams{ID: id, FamilyID: familyID, PendingAssigneeMemberID: uuid.NullUUID{UUID: to, Valid: true}})
		if err != nil {
			return err
		}
		return publish(ctx, q, familyID, p.ID, id, now)
	})
	return out, err
}

// Accept moves ownership to the person the task was offered to.
func Accept(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id uuid.UUID, now time.Time) (store.Task, error) {
	return answer(ctx, pool, familyID, p, id, now, func(q *store.Queries) (store.Task, error) {
		return q.AcceptTaskReassignment(ctx, store.AcceptTaskReassignmentParams{ID: id, FamilyID: familyID})
	})
}

// Decline drops the offer; the task stays with its assignee.
func Decline(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id uuid.UUID, now time.Time) (store.Task, error) {
	return answer(ctx, pool, familyID, p, id, now, func(q *store.Queries) (store.Task, error) {
		return q.SetTaskPendingAssignee(ctx, store.SetTaskPendingAssigneeParams{ID: id, FamilyID: familyID})
	})
}

// Withdraw takes back an offer nobody has answered yet. Only the assignee may.
func Withdraw(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id uuid.UUID, now time.Time) (store.Task, error) {
	var out store.Task
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		t, err := lock(ctx, q, familyID, id)
		if err != nil {
			return err
		}
		if t.AssigneeMemberID != p.ID {
			return ErrNotAssignee
		}
		if !t.PendingAssigneeMemberID.Valid {
			return ErrNoOffer
		}
		if out, err = q.SetTaskPendingAssignee(ctx, store.SetTaskPendingAssigneeParams{ID: id, FamilyID: familyID}); err != nil {
			return err
		}
		return publish(ctx, q, familyID, p.ID, id, now)
	})
	return out, err
}

func answer(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id uuid.UUID, now time.Time, apply func(*store.Queries) (store.Task, error)) (store.Task, error) {
	var out store.Task
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		t, err := lock(ctx, q, familyID, id)
		if err != nil {
			return err
		}
		if !t.PendingAssigneeMemberID.Valid || t.PendingAssigneeMemberID.UUID != p.ID {
			return ErrNotOfferedTo
		}
		if out, err = apply(q); err != nil {
			return err
		}
		return publish(ctx, q, familyID, p.ID, id, now)
	})
	return out, err
}

func pgInt4(n int32) pgtype.Int4 { return pgtype.Int4{Int32: n, Valid: true} }

func ts(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }
