// Package appointments holds the questions a parent wants to ask at an
// appointment. A question not answered by the time its appointment has passed
// moves to the next upcoming appointment of the same owner: that is computed on
// read (Resolve), never stored, so it always follows the calendar.
//
// Questions are health data. The author owns them and chooses who else may read
// them; reads and changes run in one transaction with access.Audit, and the live
// update goes only to people who may read the question.
package appointments

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "appointment_question"

// AnsweredWindow is how long answered questions stay in the list.
const AnsweredWindow = 30 * 24 * time.Hour

var (
	ErrNoUpcoming    = errors.New("no upcoming appointment")
	ErrNoAppointment = errors.New("no such appointment")
	ErrNoQuestion    = errors.New("no such question")
)

// Appt is an appointment the viewer may see.
type Appt struct {
	ID       uuid.UUID
	Owner    uuid.UUID
	StartsAt time.Time
}

// Resolved is a question with where it is shown now.
type Resolved struct {
	store.AppointmentQuestion
	// AppointmentID is the appointment it is under now; nil when it is unanswered
	// and its owner has no later appointment yet.
	AppointmentID *uuid.UUID
	CarriedOver   bool
}

// Resolve places each question under an appointment. An answered question, or
// one whose appointment has not passed, stays under the appointment it was
// asked for. An unanswered question of a past appointment moves to the owner's
// next upcoming appointment. Result order: unanswered first, then by
// appointment (none last), then oldest first.
func Resolve(questions []store.AppointmentQuestion, appts []Appt, now time.Time) []Resolved {
	byID := map[uuid.UUID]Appt{}
	for _, a := range appts {
		byID[a.ID] = a
	}
	next := func(owner uuid.UUID) *Appt { // appts are ordered by start
		for i := range appts {
			if appts[i].Owner == owner && !appts[i].StartsAt.Before(now) {
				return &appts[i]
			}
		}
		return nil
	}
	out := make([]Resolved, 0, len(questions))
	for _, q := range questions {
		asked, known := byID[q.AskedForEventID]
		if !known {
			continue // an appointment the viewer may not see: so not the question either
		}
		r := Resolved{AppointmentQuestion: q}
		id := asked.ID
		r.AppointmentID = &id
		if !q.Answered && asked.StartsAt.Before(now) {
			r.AppointmentID, r.CarriedOver = nil, false
			if n := next(asked.Owner); n != nil {
				nid := n.ID
				r.AppointmentID, r.CarriedOver = &nid, nid != asked.ID
			}
		}
		out = append(out, r)
	}
	start := func(r Resolved) (time.Time, bool) {
		if r.AppointmentID == nil {
			return time.Time{}, false
		}
		return byID[*r.AppointmentID].StartsAt, true
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Answered != b.Answered {
			return !a.Answered
		}
		as, aok := start(a)
		bs, bok := start(b)
		switch {
		case aok != bok:
			return aok
		case aok && !as.Equal(bs):
			return as.Before(bs)
		}
		return a.Seq.Int64 < b.Seq.Int64
	})
	return out
}

func apptsOf(rows []store.ListAppointmentEventsVisibleToParentRow) []Appt {
	out := make([]Appt, 0, len(rows))
	for _, r := range rows {
		out = append(out, Appt{ID: r.ID, Owner: r.OwnerMemberID, StartsAt: r.StartsAt})
	}
	return out
}

// audience says who is told about a question: its author alone, or both parents.
func audience(ctx context.Context, q *store.Queries, familyID uuid.UUID, owner uuid.UUID, visibility string) ([]uuid.UUID, error) {
	if visibility == string(access.Partner) || visibility == string(access.Family) {
		return live.ParentsAnd(ctx, q, familyID)
	}
	return []uuid.UUID{owner}, nil
}

// Create adds a question. Without an appointment it goes to the next upcoming one the
// parent may see, preferring their own. The visibility is exactly what the client sent.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, author uuid.UUID, text, visibility string, appointment *uuid.UUID, now time.Time) (store.AppointmentQuestion, error) {
	var out store.AppointmentQuestion
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListAppointmentEventsVisibleToParent(ctx, store.ListAppointmentEventsVisibleToParentParams{FamilyID: familyID, ViewerID: author})
		if err != nil {
			return err
		}
		appts := apptsOf(rows)
		var target *Appt
		if appointment != nil {
			for i := range appts {
				if appts[i].ID == *appointment {
					target = &appts[i]
				}
			}
			if target == nil {
				return ErrNoAppointment
			}
		} else {
			for i := range appts { // ordered by start: the first upcoming one of the author, else the first upcoming one
				if appts[i].StartsAt.Before(now) {
					continue
				}
				if appts[i].Owner == author {
					target = &appts[i]
					break
				}
				if target == nil {
					target = &appts[i]
				}
			}
			if target == nil {
				return ErrNoUpcoming
			}
		}
		out, err = q.CreateAppointmentQuestion(ctx, store.CreateAppointmentQuestionParams{
			FamilyID: familyID, OwnerMemberID: author, Visibility: visibility, AskedForEventID: target.ID, Body: text, CreatedAt: now,
		})
		if err != nil {
			return err
		}
		if err := access.Audit(ctx, q, familyID, author, access.ActionCreate, entity, out.ID.String()); err != nil {
			return err
		}
		aud, err := audience(ctx, q, familyID, author, visibility)
		if err != nil {
			return err
		}
		return live.Publish(ctx, q, familyID, live.Event{Kind: live.AppointmentQuestion, EntityID: out.ID.String(), Actor: author, Audience: aud}, now)
	})
	return out, err
}

// Result is the list answer: the questions and the upcoming appointments they are under.
type Result struct {
	Items        []Resolved
	Appointments []store.ListAppointmentEventsVisibleToParentRow
}

// List returns the questions the viewer may read, placed under appointments, and
// the upcoming appointments that have questions, soonest first. onlyAppointment
// keeps the questions that are now under that appointment.
func List(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, onlyAppointment *uuid.UUID, now time.Time) (Result, error) {
	var res Result
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		qs, err := q.ListAppointmentQuestionsVisibleToParent(ctx, store.ListAppointmentQuestionsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, AnsweredSince: pgtype.Timestamptz{Time: now.Add(-AnsweredWindow), Valid: true},
		})
		if err != nil {
			return err
		}
		rows, err := q.ListAppointmentEventsVisibleToParent(ctx, store.ListAppointmentEventsVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
		if err != nil {
			return err
		}
		items := Resolve(qs, apptsOf(rows), now)
		used := map[uuid.UUID]bool{}
		for _, it := range items {
			if onlyAppointment != nil && (it.AppointmentID == nil || *it.AppointmentID != *onlyAppointment) {
				continue
			}
			res.Items = append(res.Items, it)
			if it.AppointmentID != nil {
				used[*it.AppointmentID] = true
			}
		}
		for _, r := range rows {
			if used[r.ID] && !r.StartsAt.Before(now) {
				res.Appointments = append(res.Appointments, r)
			}
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return res, err
}

// Answer marks the author's own question answered (with an optional answer) or open again.
func Answer(ctx context.Context, pool *pgxpool.Pool, familyID, author, id uuid.UUID, answered bool, answer *string, now time.Time) (Resolved, error) {
	var out Resolved
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cur, err := q.GetOwnAppointmentQuestionVisibleToParent(ctx, store.GetOwnAppointmentQuestionVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: author})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoQuestion
		}
		if err != nil {
			return err
		}
		var at pgtype.Timestamptz
		var text *string
		if answered {
			at, text = pgtype.Timestamptz{Time: now, Valid: true}, answer
		}
		updated, err := q.AnswerAppointmentQuestionVisibleToParent(ctx, store.AnswerAppointmentQuestionVisibleToParentParams{
			ID: cur.ID, FamilyID: familyID, ViewerID: author, Answered: answered, Answer: text, AnsweredAt: at,
		})
		if err != nil {
			return err
		}
		// Where it is shown now, so the response says whether it was carried over.
		rows, err := q.ListAppointmentEventsVisibleToParent(ctx, store.ListAppointmentEventsVisibleToParentParams{FamilyID: familyID, ViewerID: author})
		if err != nil {
			return err
		}
		out = Resolved{AppointmentQuestion: updated}
		if placed := Resolve([]store.AppointmentQuestion{updated}, apptsOf(rows), now); len(placed) == 1 {
			out = placed[0]
		}
		if err := access.Audit(ctx, q, familyID, author, access.ActionUpdate, entity, id.String()); err != nil {
			return err
		}
		aud, err := audience(ctx, q, familyID, author, updated.Visibility)
		if err != nil {
			return err
		}
		return live.Publish(ctx, q, familyID, live.Event{Kind: live.AppointmentQuestion, EntityID: id.String(), Actor: author, Audience: aud}, now)
	})
	return out, err
}
