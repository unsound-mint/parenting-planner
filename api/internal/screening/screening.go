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
	"errors"
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
		// The questionnaire is finished: the draft of its instrument goes with it.
		if err := q.DeleteMoodScreeningDraft(ctx, store.DeleteMoodScreeningDraftParams{OwnerMemberID: actor, Instrument: in.Instrument}); err != nil {
			return err
		}
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

const entityDraft = "mood_screening_draft"

// DraftWindow is how long a half-finished questionnaire is kept.
const DraftWindow = 14 * 24 * time.Hour

var (
	// ErrVisibility: a result is only ever private or shared with the partner.
	ErrVisibility = errors.New("a result can only be private or shared with the partner")
	// ErrNoResult: not the author's, or unknown.
	ErrNoResult = errors.New("no such result")
)

// Share lets the author change who may read one of their results. Only private and
// partner exist: a result never reaches the care team or the family group. The partner
// sees the band and the score, never the answers and never the self-harm flag
// (resultFor hides those for anyone but the author).
func Share(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID, v access.Visibility) (Result, error) {
	if v != access.Private && v != access.Partner {
		return Result{}, ErrVisibility
	}
	var out Result
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.GetOwnMoodScreeningVisibleToParent(ctx, store.GetOwnMoodScreeningVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor}); errors.Is(err, pgx.ErrNoRows) {
			return ErrNoResult
		} else if err != nil {
			return err
		}
		row, err := q.UpdateOwnMoodScreeningVisibilityVisibleToParent(ctx, store.UpdateOwnMoodScreeningVisibilityVisibleToParentParams{ID: id, ViewerID: actor, Visibility: string(v)})
		if err != nil {
			return err
		}
		out = resultFor(actor, row)
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityMoodScreening, id.String())
	})
	return out, err
}

// ValidateDraft checks the answers so far against the instrument: no more answers than
// questions, and each one a score printed for its question.
func ValidateDraft(instrument string, answers []int) error {
	in, ok := rules.InstrumentByID(instrument)
	if !ok || len(answers) > len(in.Questions) {
		return ErrAnswers
	}
	for i, a := range answers {
		found := false
		for _, c := range in.Questions[i].Choices {
			if c.Value == a {
				found = true
			}
		}
		if !found {
			return ErrAnswers
		}
	}
	return nil
}

// Draft is a half-finished questionnaire.
type Draft struct {
	Instrument string
	Answers    []int
	UpdatedAt  time.Time
}

func draftOf(d store.MoodScreeningDraft) Draft {
	answers := make([]int, len(d.Answers))
	for i, a := range d.Answers {
		answers[i] = int(a)
	}
	return Draft{Instrument: d.Instrument, Answers: answers, UpdatedAt: d.UpdatedAt}
}

// SaveDraft replaces the author's draft for an instrument. It never scores.
func SaveDraft(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, instrument string, answers []int, now time.Time) (Draft, error) {
	if err := ValidateDraft(instrument, answers); err != nil {
		return Draft{}, err
	}
	stored := make([]int16, len(answers))
	for i, a := range answers {
		stored[i] = int16(a)
	}
	var out Draft
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := q.DeleteStaleMoodScreeningDrafts(ctx, store.DeleteStaleMoodScreeningDraftsParams{OwnerMemberID: actor, UpdatedAt: now.Add(-DraftWindow)}); err != nil {
			return err
		}
		row, err := q.UpsertMoodScreeningDraft(ctx, store.UpsertMoodScreeningDraftParams{
			FamilyID: familyID, OwnerMemberID: actor, Instrument: instrument, Answers: stored, UpdatedAt: now,
		})
		if err != nil {
			return err
		}
		out = draftOf(row)
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityDraft, instrument)
	})
	return out, err
}

// ListDrafts returns the author's own drafts from the last 14 days.
func ListDrafts(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]Draft, error) {
	var out []Draft
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListMoodScreeningDraftsVisibleToParent(ctx, store.ListMoodScreeningDraftsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-DraftWindow),
		})
		if err != nil {
			return err
		}
		out = make([]Draft, 0, len(rows))
		for _, r := range rows {
			out = append(out, draftOf(r))
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityDraft, "")
	})
	return out, err
}

// DeleteDraft discards the author's draft; no draft is not an error.
func DeleteDraft(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, instrument string) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := q.DeleteMoodScreeningDraft(ctx, store.DeleteMoodScreeningDraftParams{OwnerMemberID: actor, Instrument: instrument}); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entityDraft, instrument)
	})
}
