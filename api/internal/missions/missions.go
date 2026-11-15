// Package missions are small, concrete jobs for either parent (mostly the one
// who is not pregnant): install the car seat, batch-cook freezer meals, learn
// the swaddle. The catalogue is code (catalog.go). Taking a mission creates an
// ordinary plan task for the taker, so it appears in the plan and in the load
// map like any other task; done is read from that task. Missions carry no
// points and no pressure: a mission can be put back (swapped) at any time
// before it is done.
package missions

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrUnknown    = errors.New("no such mission")
	ErrWrongStage = errors.New("this mission is not offered at your stage")
	ErrTaken      = errors.New("this mission is already taken")
	ErrNotTaken   = errors.New("take this mission first")
	ErrIsDone     = errors.New("a finished mission cannot be put back")
)

const (
	StateOpen  = "open"
	StateTaken = "taken"
	StateDone  = "done"
)

// View is a mission as the family sees it.
type View struct {
	Mission
	State    string
	TakenBy  *uuid.UUID
	TaskID   *uuid.UUID
	DueOn    *time.Time
	Note     *string
	DoneAt   *time.Time
	DoneByID *uuid.UUID
}

// List returns the stage's missions that were not put back, plus any mission
// the family took or finished in an earlier stage, in catalogue order, except
// that the open ones rotate by week (see RotateOpen).
func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, stage Stage, week int) ([]View, error) {
	q := store.New(pool)
	picks, err := q.ListMissionPicks(ctx, familyID)
	if err != nil {
		return nil, err
	}
	rows, err := q.ListTasks(ctx, store.ListTasksParams{FamilyID: familyID})
	if err != nil {
		return nil, err
	}
	tasks := map[uuid.UUID]store.Task{}
	for _, t := range rows {
		tasks[t.ID] = t
	}
	pickOf := map[string]store.MissionPick{}
	for _, p := range picks {
		pickOf[p.MissionKey] = p
	}
	out := []View{}
	for _, m := range Catalog {
		p, picked := pickOf[m.Key]
		if picked && p.Status == "swapped" {
			continue
		}
		if !picked && m.Stage != stage {
			continue
		}
		v := View{Mission: m, State: StateOpen}
		if picked {
			t, ok := tasks[p.TaskID.UUID]
			if !ok {
				continue
			}
			id, assignee := t.ID, t.AssigneeMemberID
			v.State, v.TaskID, v.TakenBy, v.Note, v.DueOn = StateTaken, &id, &assignee, p.Note, t.DueOn
			if t.Done {
				v.State = StateDone
				v.DoneAt = &t.DoneAt.Time
				if t.DoneByMemberID.Valid {
					by := t.DoneByMemberID.UUID
					v.DoneByID = &by
				}
			}
		}
		out = append(out, v)
	}
	return RotateOpen(out, week), nil
}

// RotateOpen keeps taken and done missions where they are and rotates the
// open ones through the open slots by week, so the first open mission (the one
// This week suggests) changes every week. week is any count that moves by one
// each week (content.CalendarWeek on the family's clock).
func RotateOpen(views []View, week int) []View {
	var slots []int
	var open []View
	for i, v := range views {
		if v.State == StateOpen {
			slots = append(slots, i)
			open = append(open, v)
		}
	}
	n := len(open)
	if n < 2 {
		return views
	}
	out := append([]View(nil), views...)
	k := (week%n + n) % n
	for j, i := range slots {
		out[i] = open[(j+k)%n]
	}
	return out
}

func publish(ctx context.Context, q *store.Queries, familyID, actor, taskID uuid.UUID, now time.Time) error {
	return live.Publish(ctx, q, familyID, live.Event{Kind: live.Task, EntityID: taskID.String(), Actor: actor, NeedsPermission: "family_plan"}, now)
}

// Take makes the acting parent responsible for a mission of the current stage.
// A mission that was put back can be taken again.
func Take(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, stage Stage, key string, today, now time.Time) (View, error) {
	m, ok := ByKey(key)
	if !ok {
		return View{}, ErrUnknown
	}
	if m.Stage != stage {
		return View{}, ErrWrongStage
	}
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		params := store.CreateTaskParams{
			FamilyID: familyID, Kind: "task", Title: m.Title, Detail: &m.Why,
			AssigneeMemberID: actor, CreatedByMemberID: actor,
		}
		if m.DueDays > 0 {
			due := today.AddDate(0, 0, m.DueDays)
			params.DueOn = &due
		}
		if m.Source != nil {
			checked := m.Source.CheckedAt
			params.SourceTitle, params.SourceUrl, params.SourceCheckedOn = &m.Source.Title, &m.Source.URL, &checked
		}
		t, err := q.CreateTask(ctx, params)
		if err != nil {
			return err
		}
		_, err = q.TakeMissionPick(ctx, store.TakeMissionPickParams{FamilyID: familyID, MissionKey: key, TaskID: uuid.NullUUID{UUID: t.ID, Valid: true}})
		var pgErr *pgconn.PgError
		switch {
		case errors.Is(err, pgx.ErrNoRows), errors.As(err, &pgErr) && pgErr.Code == "23505":
			return ErrTaken
		case err != nil:
			return err
		}
		return publish(ctx, q, familyID, actor, t.ID, now)
	})
	if err != nil {
		return View{}, err
	}
	return one(ctx, pool, familyID, stage, key)
}

// Done finishes a taken mission, with an optional one-line note. afterDone runs
// in the same transaction (the sticker sync). Finishing twice only updates the note.
func Done(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, stage Stage, key string, note *string, now time.Time, afterDone func(context.Context, *store.Queries) error) (View, error) {
	if _, ok := ByKey(key); !ok {
		return View{}, ErrUnknown
	}
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		p, err := q.GetMissionPickForUpdate(ctx, store.GetMissionPickForUpdateParams{FamilyID: familyID, MissionKey: key})
		if errors.Is(err, pgx.ErrNoRows) || err == nil && p.Status != "taken" {
			return ErrNotTaken
		}
		if err != nil {
			return err
		}
		t, err := q.GetTaskForUpdate(ctx, store.GetTaskForUpdateParams{ID: p.TaskID.UUID, FamilyID: familyID})
		if err != nil {
			return err
		}
		if !t.Done {
			if _, err := q.SetTaskDone(ctx, store.SetTaskDoneParams{
				ID: t.ID, FamilyID: familyID, Done: true,
				DoneAt: pgtype.Timestamptz{Time: now, Valid: true}, DoneByMemberID: uuid.NullUUID{UUID: actor, Valid: true},
			}); err != nil {
				return err
			}
		}
		if err := q.SetMissionNote(ctx, store.SetMissionNoteParams{FamilyID: familyID, MissionKey: key, Note: note}); err != nil {
			return err
		}
		if afterDone != nil {
			if err := afterDone(ctx, q); err != nil {
				return err
			}
		}
		return publish(ctx, q, familyID, actor, t.ID, now)
	})
	if err != nil {
		return View{}, err
	}
	return one(ctx, pool, familyID, stage, key)
}

// Swap puts a mission back: it leaves the suggestions and its plan task goes
// away. It works on an open or a taken mission, never a finished one.
func Swap(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, key string, now time.Time) error {
	if _, ok := ByKey(key); !ok {
		return ErrUnknown
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		p, err := q.GetMissionPickForUpdate(ctx, store.GetMissionPickForUpdateParams{FamilyID: familyID, MissionKey: key})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		var taskID uuid.UUID
		if err == nil && p.TaskID.Valid {
			t, err := q.GetTaskForUpdate(ctx, store.GetTaskForUpdateParams{ID: p.TaskID.UUID, FamilyID: familyID})
			if err != nil {
				return err
			}
			if t.Done {
				return ErrIsDone
			}
			taskID = t.ID
		}
		if err := q.SwapMissionPick(ctx, store.SwapMissionPickParams{FamilyID: familyID, MissionKey: key}); err != nil {
			return err
		}
		if taskID != uuid.Nil {
			if err := q.DeleteTask(ctx, store.DeleteTaskParams{ID: taskID, FamilyID: familyID}); err != nil {
				return err
			}
			return publish(ctx, q, familyID, actor, taskID, now)
		}
		return nil
	})
}

func one(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, stage Stage, key string) (View, error) {
	all, err := List(ctx, pool, familyID, stage, 0) // looked up by key, so the order does not matter
	if err != nil {
		return View{}, err
	}
	for _, v := range all {
		if v.Key == key {
			return v, nil
		}
	}
	return View{}, ErrUnknown
}
