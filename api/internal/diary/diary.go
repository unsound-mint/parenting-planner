// Package diary is a parent's private diary. Built like internal/wellbeing:
// each create, list and change runs in one transaction with access.Audit, reads
// use the *VisibleToParent SQL, and the text is encrypted before it is stored.
package diary

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "diary_entry"

// PageSize is how many entries one list call returns when the caller does not
// say; MaxPageSize is the contract's maximum.
const (
	PageSize    = 60
	MaxPageSize = 100
)

var ErrNoEntry = errors.New("no such diary entry")

// Entry is a row with its text decrypted.
type Entry struct {
	store.DiaryEntry
	Body string
}

type New struct {
	Body        string
	Visibility  access.Visibility
	AgendaTopic *string
	Mood        *int // 1 to 5, optional; the contract bounds it
	First       bool
	WrittenAt   time.Time
}

func topic(t *string) *string {
	if t == nil {
		return nil
	}
	v := strings.TrimSpace(*t)
	if v == "" {
		return nil
	}
	return &v
}

func mood(m *int) pgtype.Int2 {
	if m == nil {
		return pgtype.Int2{}
	}
	return pgtype.Int2{Int16: int16(*m), Valid: true}
}

func open(key crypt.Key, row store.DiaryEntry) (Entry, error) {
	body, err := key.Open(row.BodySealed)
	return Entry{DiaryEntry: row, Body: body}, err
}

func Create(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor uuid.UUID, in New) (Entry, error) {
	sealed, err := key.Seal(in.Body)
	if err != nil {
		return Entry{}, err
	}
	var out Entry
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.CreateDiaryEntry(ctx, store.CreateDiaryEntryParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility), WrittenAt: in.WrittenAt,
			BodySealed: sealed, AgendaTopic: topic(in.AgendaTopic), Mood: mood(in.Mood), IsFirst: in.First,
		})
		if err != nil {
			return err
		}
		out = Entry{DiaryEntry: row, Body: in.Body}
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entity, row.ID.String())
	})
	return out, err
}

// Page is one page of the diary, newest first. NextBefore is set when older
// entries exist: pass it as before to read them.
type Page struct {
	Entries    []Entry
	NextBefore *time.Time
}

// List reads up to limit entries written before before (now when nil), only
// the ones marked as a first when firstsOnly.
func List(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, viewer uuid.UUID, now time.Time, before *time.Time, limit int, firstsOnly bool) (Page, error) {
	if limit <= 0 || limit > MaxPageSize {
		limit = PageSize
	}
	// The first page has no upper bound: an entry saved this instant (the demo clock
	// stands still in tests) must be on it.
	until := now.AddDate(100, 0, 0)
	if before != nil {
		until = *before
	}
	var out Page
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		// One extra row says whether an older page exists without a count query.
		rows, err := q.ListDiaryEntriesVisibleToParent(ctx, store.ListDiaryEntriesVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Before: until, FirstsOnly: firstsOnly, PageSize: int32(limit + 1),
		})
		if err != nil {
			return err
		}
		if len(rows) > limit {
			rows = rows[:limit]
			last := rows[limit-1].WrittenAt
			out.NextBefore = &last
		}
		for _, r := range rows {
			e, err := open(key, r)
			if errors.Is(err, crypt.ErrCannotDecrypt) {
				// Sealed with an earlier key: without DIARY_ENCRYPTION_KEY each restart makes a
				// new one. Leave the entry out instead of failing the whole diary.
				continue
			}
			if err != nil {
				return err
			}
			out.Entries = append(out.Entries, e)
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return out, err
}

// Change is what the author edits on an entry. Nil fields keep their value;
// an empty AgendaTopic removes the topic.
type Change struct {
	Visibility  access.Visibility
	AgendaTopic *string
	First       *bool
	Body        *string // trimmed and non-empty; the handler checks
	Mood        *int
}

// Update lets the author change who may read an entry, its text and mood, its
// agenda topic and whether it is a first.
func Update(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor, id uuid.UUID, c Change) (Entry, error) {
	var out Entry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cur, err := q.GetOwnDiaryEntryVisibleToParent(ctx, store.GetOwnDiaryEntryVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoEntry
		}
		if err != nil {
			return err
		}
		next := cur.AgendaTopic
		if c.AgendaTopic != nil {
			next = topic(c.AgendaTopic)
		}
		isFirst := cur.IsFirst
		if c.First != nil {
			isFirst = *c.First
		}
		if c.Body != nil || c.Mood != nil {
			sealed, m := cur.BodySealed, cur.Mood
			if c.Body != nil {
				if sealed, err = key.Seal(*c.Body); err != nil {
					return err
				}
			}
			if c.Mood != nil {
				m = mood(c.Mood)
			}
			if _, err := q.UpdateOwnDiaryEntryContent(ctx, store.UpdateOwnDiaryEntryContentParams{
				ID: id, FamilyID: familyID, ViewerID: actor, BodySealed: sealed, Mood: m,
			}); err != nil {
				return err
			}
		}
		row, err := q.UpdateOwnDiaryEntryVisibleToParent(ctx, store.UpdateOwnDiaryEntryVisibleToParentParams{
			ID: id, FamilyID: familyID, ViewerID: actor, Visibility: string(c.Visibility), AgendaTopic: next, IsFirst: isFirst,
		})
		if err != nil {
			return err
		}
		if out, err = open(key, row); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entity, id.String())
	})
	return out, err
}

// Delete removes one of the author's entries. Its topic leaves the agenda
// with it, and briefs not sent yet stop carrying its text.
func Delete(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID, now time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		topic, err := q.DeleteOwnDiaryEntry(ctx, store.DeleteOwnDiaryEntryParams{ID: id, FamilyID: familyID, ViewerID: actor})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoEntry
		}
		if err != nil {
			return err
		}
		if err := q.DropEntryFromSessionBriefs(ctx, store.DropEntryFromSessionBriefsParams{
			EntryID: id, Now: now, FamilyID: familyID, OwnerMemberID: actor,
		}); err != nil {
			return err
		}
		// Its topic was on the agenda, so a brief waiting to go out would
		// still carry the title: back to a draft for the parent to look at.
		if topic != nil {
			if err := q.UnscheduleOwnPendingSessionBriefs(ctx, store.UnscheduleOwnPendingSessionBriefsParams{
				Now: now, FamilyID: familyID, OwnerMemberID: actor,
			}); err != nil {
				return err
			}
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entity, id.String())
	})
}
