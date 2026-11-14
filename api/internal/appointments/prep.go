package appointments

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const noteEntity = "appointment_note"

var ErrVisitNotStarted = errors.New("visit not started")

type Prep struct {
	Event     store.GetAppointmentEventVisibleToParentRow
	Questions []Resolved
	Note      *store.GetAppointmentNoteVisibleToParentRow
}

func visit(ctx context.Context, q *store.Queries, familyID, parent, id uuid.UUID) (store.GetAppointmentEventVisibleToParentRow, error) {
	event, err := q.GetAppointmentEventVisibleToParent(ctx, store.GetAppointmentEventVisibleToParentParams{
		FamilyID: familyID, ViewerID: parent, ID: id,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return event, ErrNoAppointment
	}
	return event, err
}

func GetPrep(ctx context.Context, pool *pgxpool.Pool, familyID, parent, id uuid.UUID, now time.Time) (Prep, error) {
	var out Prep
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		event, err := visit(ctx, q, familyID, parent, id)
		if err != nil {
			return err
		}
		out.Event = event
		asOf := now
		if event.StartsAt.Before(asOf) {
			asOf = event.StartsAt
		}
		questions, err := q.ListPrepQuestionsVisibleToParent(ctx, store.ListPrepQuestionsVisibleToParentParams{
			FamilyID: familyID, ViewerID: parent, AsOf: asOf,
		})
		if err != nil {
			return err
		}
		events, err := q.ListAppointmentEventsVisibleToParent(ctx, store.ListAppointmentEventsVisibleToParentParams{FamilyID: familyID, ViewerID: parent})
		if err != nil {
			return err
		}
		// Match the placement at the start of the visit, then restore the
		// present answer so the after-visit screen can show edits.
		historical := slices.Clone(questions)
		for i := range historical {
			if answered := historical[i].AnsweredAt; answered.Valid && answered.Time.After(asOf) {
				historical[i].Answered = false
			}
		}
		current := make(map[uuid.UUID]store.AppointmentQuestion, len(questions))
		for _, question := range questions {
			current[question.ID] = question
		}
		for _, placed := range Resolve(historical, apptsOf(events), asOf) {
			if placed.AppointmentID != nil && *placed.AppointmentID == id {
				placed.AppointmentQuestion = current[placed.ID]
				out.Questions = append(out.Questions, placed)
			}
		}
		slices.SortStableFunc(out.Questions, func(a, b Resolved) int {
			switch {
			case a.Answered == b.Answered:
				return 0
			case a.Answered:
				return 1
			default:
				return -1
			}
		})
		note, err := q.GetAppointmentNoteVisibleToParent(ctx, store.GetAppointmentNoteVisibleToParentParams{
			FamilyID: familyID, AuthorID: parent, AppointmentID: id,
		})
		if err == nil {
			out.Note = &note
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if err := access.Audit(ctx, q, familyID, parent, access.ActionRead, entity, id.String()); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, parent, access.ActionRead, noteEntity, id.String())
	})
	return out, err
}

func SaveNote(ctx context.Context, pool *pgxpool.Pool, familyID, parent, id uuid.UUID, body string, now time.Time) (store.SaveAppointmentNoteRow, error) {
	out := store.SaveAppointmentNoteRow{Body: body, UpdatedAt: now}
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		event, err := visit(ctx, q, familyID, parent, id)
		if err != nil {
			return err
		}
		if event.StartsAt.After(now) {
			return ErrVisitNotStarted
		}
		action := access.ActionUpdate
		if body == "" {
			action = access.ActionDelete
			err = q.DeleteAppointmentNote(ctx, store.DeleteAppointmentNoteParams{FamilyID: familyID, AuthorID: parent, AppointmentID: id})
		} else {
			out, err = q.SaveAppointmentNote(ctx, store.SaveAppointmentNoteParams{
				FamilyID: familyID, AuthorID: parent, AppointmentID: id, Body: body, UpdatedAt: now,
			})
		}
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, parent, action, noteEntity, id.String())
	})
	return out, err
}
