// Package screening owns mood questionnaires (EPDS, PHQ-9): scoring a
// completed one, listing results and saying which one the plan asks for.
// Copied from internal/wellbeing: every write and list runs in one
// transaction with access.Audit, and lists use the *VisibleToParent SQL.
//
// Results never notify anyone, never send a live update and are not counted
// by analytics (its sources are an allow-list without this table).
package screening

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityMoodScreening = "mood_screening"

// ListWindow is how far back ListMoodScreenings looks.
const ListWindow = 365 * 24 * time.Hour

// ErrAnswers: the answers do not fit the instrument (400).
var ErrAnswers = rules.ErrAnswers

type NewMoodScreening struct {
	Instrument string
	Answers    []int
	Visibility access.Visibility
	TakenAt    time.Time
}

// Result is a stored questionnaire as one viewer may see it.
type Result struct {
	store.MoodScreening
	MaxScore int
	// Own is true for the viewer's own result. For anyone else's, Urgent is
	// false and Message is empty: the self-harm answer is only ever shown to
	// its author.
	Own     bool
	Message string
	Source  rules.Source
}

func resultFor(viewer uuid.UUID, s store.MoodScreening) Result {
	in, _ := rules.InstrumentByID(s.Instrument)
	r := Result{MoodScreening: s, MaxScore: in.MaxScore(), Own: s.OwnerMemberID == viewer, Source: in.ScoringSource}
	if !r.Own {
		r.Urgent = false
		r.Answers = nil
		return r
	}
	r.Message = rules.BandMessage(s.Instrument, rules.Band(s.Band))
	if s.Urgent {
		r.Message = rules.UrgentMessage
	}
	return r
}

// Create scores the answers server-side and stores the result.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewMoodScreening) (Result, error) {
	sc, err := rules.Score(in.Instrument, in.Answers)
	if err != nil {
		return Result{}, err
	}
	answers := make([]int16, len(in.Answers))
	for i, a := range in.Answers {
		answers[i] = int16(a)
	}
	var out Result
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		s, err := q.CreateMoodScreening(ctx, store.CreateMoodScreeningParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility), TakenAt: in.TakenAt,
			Instrument: in.Instrument, Answers: answers, Score: int16(sc.Score), Band: string(sc.Band), Urgent: sc.Urgent,
		})
		if err != nil {
			return err
		}
		out = resultFor(actor, s)
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityMoodScreening, s.ID.String())
	})
	return out, err
}

// List returns the viewer's own results and the ones shared with them.
func List(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]Result, error) {
	var out []Result
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListMoodScreeningsVisibleToParent(ctx, store.ListMoodScreeningsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-ListWindow),
		})
		if err != nil {
			return err
		}
		out = make([]Result, 0, len(rows))
		for _, r := range rows {
			out = append(out, resultFor(viewer, r))
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityMoodScreening, "")
	})
	return out, err
}

// Questionnaire is a catalog entry with whether the viewer's plan asks for it.
type Questionnaire struct {
	rules.Instrument
	Suggested bool
}

// Questionnaires lists the catalog for the viewer. The suggestion comes from
// the viewer's own plan facts, so it never depends on the other parent's data.
func Questionnaires(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, today, now time.Time) ([]Questionnaire, error) {
	f, err := plan.LoadFacts(ctx, store.New(pool), familyID, viewer, today, now)
	if err != nil {
		return nil, err
	}
	want, _ := rules.SuggestedInstrument(f)
	out := []Questionnaire{}
	for _, in := range rules.Instruments() {
		out = append(out, Questionnaire{Instrument: in, Suggested: in.ID == want})
	}
	return out, nil
}
