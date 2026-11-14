// Package calendar owns appointments and the questions parents prepare for
// them. Copied from internal/wellbeing: every function runs in one transaction
// with access.Audit, and reads use the *VisibleToParent queries.
package calendar

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityQuestion = "appointment_question"

// AnsweredWindow is how long an answered question stays in the list.
const AnsweredWindow = 30 * 24 * time.Hour

var (
	// ErrNoAppointment: the appointment does not exist or the parent may not see it.
	ErrNoAppointment = errors.New("no such appointment")
	// ErrNoUpcomingAppointment: no appointment to attach a new question to.
	ErrNoUpcomingAppointment = errors.New("no upcoming appointment")
	// ErrNoQuestion: the question does not exist or is not the parent's own.
	ErrNoQuestion = errors.New("no such question")
)

// Question is a question as shown to one viewer.
type Question struct {
	ID                    uuid.UUID
	AuthorID              uuid.UUID
	Text                  string
	AppointmentID         *uuid.UUID // where it shows now; nil when unanswered and no later appointment exists
	AskedForAppointmentID uuid.UUID
	CarriedOver           bool
	AnsweredAt            *time.Time
	Answer                *string
	Visibility            access.Visibility
	CreatedAt             time.Time
	startsAt              time.Time // of the appointment it shows under, for ordering
}

type NewQuestion struct {
	Text          string
	AppointmentID *uuid.UUID // default: the next upcoming appointment the author may see
	Visibility    access.Visibility
}

func CreateQuestion(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, now time.Time, in NewQuestion) (Question, error) {
	var out Question
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var appt store.CalendarEvent
		var err error
		if in.AppointmentID != nil {
			appt, err = q.GetAppointmentVisibleToParent(ctx, store.GetAppointmentVisibleToParentParams{ID: *in.AppointmentID, FamilyID: familyID, ViewerID: uuid.NullUUID{UUID: actor, Valid: true}})
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNoAppointment
			}
		} else {
			appt, err = q.NextAppointmentVisibleToParent(ctx, store.NextAppointmentVisibleToParentParams{FamilyID: familyID, Now: now, ViewerID: uuid.NullUUID{UUID: actor, Valid: true}})
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNoUpcomingAppointment
			}
		}
		if err != nil {
			return err
		}
		row, err := q.CreateAppointmentQuestion(ctx, store.CreateAppointmentQuestionParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility), AppointmentID: appt.ID, Text: in.Text,
		})
		if err != nil {
			return err
		}
		out = newQuestion(row.ID, row.OwnerMemberID, row.Text, row.AppointmentID, row.Visibility, row.CreatedAt, nil, nil)
		out.startsAt = appt.StartsAt
		if appt.StartsAt.Before(now) {
			// Added to a past appointment: it shows under the next one, if any.
			out.AppointmentID = nil
			next, err := q.NextAppointmentVisibleToParent(ctx, store.NextAppointmentVisibleToParentParams{FamilyID: familyID, Now: now, ViewerID: uuid.NullUUID{UUID: actor, Valid: true}})
			if err == nil && next.OwnerMemberID == appt.OwnerMemberID {
				out.AppointmentID, out.CarriedOver = &next.ID, true
			} else if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return err
			}
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityQuestion, row.ID.String())
	})
	return out, err
}

// List is the viewer's questions with the upcoming appointments they sit under.
func ListQuestions(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time, onlyAppointment *uuid.UUID) ([]Question, []store.CalendarEvent, error) {
	var items []Question
	var appts []store.CalendarEvent
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		items, appts, err = visibleQuestions(ctx, q, familyID, viewer, now, uuid.NullUUID{})
		if err != nil {
			return err
		}
		if onlyAppointment != nil {
			items = slices.DeleteFunc(items, func(it Question) bool { return it.AppointmentID == nil || *it.AppointmentID != *onlyAppointment })
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityQuestion, "")
	})
	return items, appts, err
}

// AnswerQuestion marks the author's own question answered, or reopens it.
func AnswerQuestion(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID, now time.Time, answered bool, answer *string) (Question, error) {
	var out Question
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		at := pgtype.Timestamptz{}
		if answered {
			at = pgtype.Timestamptz{Time: now, Valid: true}
		} else {
			answer = nil
		}
		if _, err := q.AnswerAppointmentQuestion(ctx, store.AnswerAppointmentQuestionParams{AnsweredAt: at, Answer: answer, ID: id, FamilyID: familyID, OwnerID: actor}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNoQuestion
			}
			return err
		}
		items, _, err := visibleQuestions(ctx, q, familyID, actor, now, uuid.NullUUID{UUID: id, Valid: true})
		if err != nil {
			return err
		}
		if len(items) != 1 {
			return ErrNoQuestion
		}
		out = items[0]
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityQuestion, id.String())
	})
	return out, err
}

// visibleQuestions reads through ListAppointmentQuestionsVisibleToParent,
// places each question under its current appointment and orders them:
// unanswered first, then by appointment start, then oldest first.
func visibleQuestions(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, now time.Time, questionID uuid.NullUUID) ([]Question, []store.CalendarEvent, error) {
	rows, err := q.ListAppointmentQuestionsVisibleToParent(ctx, store.ListAppointmentQuestionsVisibleToParentParams{
		Now: now, ViewerID: viewer, FamilyID: familyID, Since: now.Add(-AnsweredWindow), QuestionID: questionID,
	})
	if err != nil {
		return nil, nil, err
	}
	// Unanswered questions of a past appointment move to the next one.
	var ids []uuid.UUID
	for _, r := range rows {
		if r.AnsweredAt.Valid || r.AppointmentStartsAt.After(now) {
			ids = append(ids, r.AppointmentID)
		} else if r.NextAppointmentID != uuid.Nil {
			ids = append(ids, r.NextAppointmentID)
		}
	}
	upcoming, err := q.ListUpcomingAppointmentsVisibleToParent(ctx, store.ListUpcomingAppointmentsVisibleToParentParams{
		FamilyID: familyID, Now: now, Ids: ids, ViewerID: uuid.NullUUID{UUID: viewer, Valid: true},
	})
	if err != nil {
		return nil, nil, err
	}
	starts := map[uuid.UUID]time.Time{}
	for _, a := range upcoming {
		starts[a.ID] = a.StartsAt
	}
	items := make([]Question, 0, len(rows))
	shown := map[uuid.UUID]bool{}
	for _, r := range rows {
		var answeredAt *time.Time
		if r.AnsweredAt.Valid {
			answeredAt = &r.AnsweredAt.Time
		}
		it := newQuestion(r.ID, r.OwnerMemberID, r.Text, r.AppointmentID, r.Visibility, r.CreatedAt, answeredAt, r.Answer)
		it.startsAt = r.AppointmentStartsAt
		if answeredAt == nil && !r.AppointmentStartsAt.After(now) {
			it.AppointmentID, it.startsAt = nil, time.Time{}
			if r.NextAppointmentID != uuid.Nil {
				it.AppointmentID, it.CarriedOver, it.startsAt = &r.NextAppointmentID, true, starts[r.NextAppointmentID]
			}
		}
		if it.AppointmentID != nil && it.startsAt.After(now) {
			if _, ok := starts[*it.AppointmentID]; ok {
				shown[*it.AppointmentID] = true
			} else {
				// An upcoming appointment this viewer may not see (the author's private one).
				it.AppointmentID, it.startsAt = nil, time.Time{}
			}
		}
		items = append(items, it)
	}
	slices.SortStableFunc(items, func(a, b Question) int {
		switch {
		case (a.AnsweredAt == nil) != (b.AnsweredAt == nil):
			if a.AnsweredAt == nil {
				return -1
			}
			return 1
		case a.startsAt.IsZero() != b.startsAt.IsZero():
			if b.startsAt.IsZero() {
				return -1
			}
			return 1
		}
		if c := a.startsAt.Compare(b.startsAt); c != 0 {
			return c
		}
		return a.CreatedAt.Compare(b.CreatedAt)
	})
	var appts []store.CalendarEvent
	for _, a := range upcoming {
		if shown[a.ID] {
			appts = append(appts, a)
		}
	}
	return items, appts, nil
}

func newQuestion(id, author uuid.UUID, text string, appointment uuid.UUID, visibility string, createdAt time.Time, answeredAt *time.Time, answer *string) Question {
	return Question{
		ID: id, AuthorID: author, Text: text, AppointmentID: &appointment, AskedForAppointmentID: appointment,
		AnsweredAt: answeredAt, Answer: answer, Visibility: access.Visibility(visibility), CreatedAt: createdAt,
	}
}
