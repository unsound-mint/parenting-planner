// Package wellbeing owns mood check-ins and the diary.
//
// REFERENCE MODULE: this is the pattern every sensitive-data module copies.
// See api/AGENTS.md, "Recipe: add a module". The parts to copy:
//   - functions take the store, the family id and the acting member id;
//   - writes and lists run in one transaction together with access.Audit;
//   - list queries use the *VisibleToParent SQL, which mirrors access.CanParentRead;
//   - input validation is already done by the OpenAPI middleware, so only
//     business rules that the contract cannot express live here.
package wellbeing

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityMoodCheckin = "mood_checkin"

// ListWindow is how far back ListMoodCheckins looks.
const ListWindow = 30 * 24 * time.Hour

type NewMoodCheckin struct {
	Mood       int16
	Energy     int16
	SleepHours float64
	Note       *string
	Visibility access.Visibility
	RecordedAt time.Time
}

func CreateMoodCheckin(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewMoodCheckin) (store.MoodCheckin, error) {
	var out store.MoodCheckin
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		c, err := q.CreateMoodCheckin(ctx, store.CreateMoodCheckinParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility),
			RecordedAt: in.RecordedAt, Mood: in.Mood, Energy: in.Energy, SleepHours: in.SleepHours, Note: in.Note,
		})
		if err != nil {
			return err
		}
		out = c
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityMoodCheckin, c.ID.String())
	})
	return out, err
}

func ListMoodCheckins(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]store.MoodCheckin, error) {
	var out []store.MoodCheckin
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListMoodCheckinsVisibleToParent(ctx, store.ListMoodCheckinsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-ListWindow),
		})
		if err != nil {
			return err
		}
		out = rows
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityMoodCheckin, "")
	})
	return out, err
}

const entityDiaryEntry = "diary_entry"

type NewDiaryEntry struct {
	Body       string
	Visibility access.Visibility
	WrittenAt  time.Time
}

func CreateDiaryEntry(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewDiaryEntry) (store.DiaryEntry, error) {
	var out store.DiaryEntry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		e, err := q.CreateDiaryEntry(ctx, store.CreateDiaryEntryParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility),
			WrittenAt: in.WrittenAt, Body: in.Body,
		})
		if err != nil {
			return err
		}
		out = e
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityDiaryEntry, e.ID.String())
	})
	return out, err
}

func ListDiaryEntries(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]store.DiaryEntry, error) {
	var out []store.DiaryEntry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListDiaryEntriesVisibleToParent(ctx, store.ListDiaryEntriesVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-ListWindow),
		})
		if err != nil {
			return err
		}
		out = rows
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityDiaryEntry, "")
	})
	return out, err
}

// ErrNotAuthor means the entry does not exist in this family or belongs to
// someone else; callers answer 404 so the two cases look the same.
var ErrNotAuthor = errors.New("diary entry not found for this author")

// ShareDiaryEntry sets who may read one entry. Only its author can do this.
func ShareDiaryEntry(ctx context.Context, pool *pgxpool.Pool, familyID, actor, entryID uuid.UUID, v access.Visibility) (store.DiaryEntry, error) {
	var out store.DiaryEntry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		e, err := q.UpdateDiaryEntryVisibility(ctx, store.UpdateDiaryEntryVisibilityParams{
			Visibility: string(v), ID: entryID, FamilyID: familyID, OwnerMemberID: actor,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotAuthor
		}
		if err != nil {
			return err
		}
		out = e
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityDiaryEntry, e.ID.String())
	})
	return out, err
}
