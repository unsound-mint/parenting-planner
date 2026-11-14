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

// ListWindow is how far back the list looks.
const ListWindow = 30 * 24 * time.Hour

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

func List(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, viewer uuid.UUID, now time.Time) ([]Entry, error) {
	var out []Entry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListDiaryEntriesVisibleToParent(ctx, store.ListDiaryEntriesVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-ListWindow),
		})
		if err != nil {
			return err
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
			out = append(out, e)
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return out, err
}

// Update lets the author change who may read an entry, its agenda topic and
// whether it is a first. agendaTopic nil keeps the topic; an empty string
// removes it. first nil keeps the mark.
func Update(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor, id uuid.UUID, v access.Visibility, agendaTopic *string, first *bool) (Entry, error) {
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
		if agendaTopic != nil {
			next = topic(agendaTopic)
		}
		isFirst := cur.IsFirst
		if first != nil {
			isFirst = *first
		}
		row, err := q.UpdateOwnDiaryEntryVisibleToParent(ctx, store.UpdateOwnDiaryEntryVisibleToParentParams{
			ID: id, FamilyID: familyID, ViewerID: actor, Visibility: string(v), AgendaTopic: next, IsFirst: isFirst,
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
