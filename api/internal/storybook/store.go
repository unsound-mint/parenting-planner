package storybook

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "story"

var ErrNoStory = errors.New("no such story")

// Story is a stored row with its JSON decoded.
type Story struct {
	store.Story
	MemoryLines []string
	PageList    []Page
}

func decode(row store.Story) (Story, error) {
	s := Story{Story: row}
	if err := json.Unmarshal(row.Memories, &s.MemoryLines); err != nil {
		return s, err
	}
	err := json.Unmarshal(row.Pages, &s.PageList)
	return s, err
}

// New is a finished book ready to store.
type New struct {
	Visibility access.Visibility
	ChildID    uuid.NullUUID
	Facts      Facts
	Book       Book
	CreatedAt  time.Time
}

// Insert stores a story without auditing; Create and the demo seed use it.
func Insert(ctx context.Context, q *store.Queries, familyID, owner uuid.UUID, in New) (Story, error) {
	memories, err := json.Marshal(in.Facts.Memories)
	if err != nil {
		return Story{}, err
	}
	pages, err := json.Marshal(in.Book.Pages)
	if err != nil {
		return Story{}, err
	}
	var age pgtype.Int4
	if in.Facts.AgeMonths != nil {
		age = pgtype.Int4{Int32: int32(*in.Facts.AgeMonths), Valid: true}
	}
	row, err := q.CreateStory(ctx, store.CreateStoryParams{
		FamilyID: familyID, OwnerMemberID: owner, Visibility: string(in.Visibility), ChildID: in.ChildID,
		ChildName: in.Facts.ChildName, AgeMonths: age, Theme: string(in.Facts.Theme), SignedAs: in.Facts.SignedAs,
		Title: in.Book.Title, Memories: memories, Pages: pages, GeneratedBy: in.Book.GeneratedBy, CreatedAt: in.CreatedAt,
	})
	if err != nil {
		return Story{}, err
	}
	return decode(row)
}

func Create(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in New) (Story, error) {
	var out Story
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		s, err := Insert(ctx, q, familyID, actor, in)
		if err != nil {
			return err
		}
		out = s
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entity, s.ID.String())
	})
	return out, err
}

func List(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID) ([]Story, error) {
	var out []Story
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListStoriesVisibleToParent(ctx, store.ListStoriesVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
		if err != nil {
			return err
		}
		for _, r := range rows {
			s, err := decode(r)
			if err != nil {
				return err
			}
			out = append(out, s)
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return out, err
}

func Get(ctx context.Context, pool *pgxpool.Pool, familyID, viewer, id uuid.UUID) (Story, error) {
	var out Story
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.GetStoryVisibleToParent(ctx, store.GetStoryVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: viewer})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoStory
		}
		if err != nil {
			return err
		}
		if out, err = decode(row); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, id.String())
	})
	return out, err
}

// SetVisibility lets the author share or unshare a story.
func SetVisibility(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID, v access.Visibility) (Story, error) {
	var out Story
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.UpdateOwnStoryVisibleToParent(ctx, store.UpdateOwnStoryVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor, Visibility: string(v)})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoStory
		}
		if err != nil {
			return err
		}
		if out, err = decode(row); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entity, id.String())
	})
	return out, err
}

func Delete(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.DeleteOwnStoryVisibleToParent(ctx, store.DeleteOwnStoryVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor})
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNoStory
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entity, id.String())
	})
}

// Shareable reports whether v is a visibility a story may have.
func Shareable(v access.Visibility) bool { return v == access.Private || v == access.Partner }

// Seed stores a template story for a demo family, made the same way a parent's
// story is made without a key.
func Seed(ctx context.Context, q *store.Queries, familyID, owner, childID uuid.UUID, childName string, born, today time.Time, theme Theme, signedAs string, v access.Visibility, daysAgo int, memories ...string) error {
	months := (today.Year()-born.Year())*12 + int(today.Month()-born.Month())
	if today.Day() < born.Day() {
		months--
	}
	months = max(months, 0)
	f, err := NewFacts(childName, &months, theme, signedAs, memories)
	if err != nil {
		return err
	}
	_, err = Insert(ctx, q, familyID, owner, New{
		Visibility: v, ChildID: uuid.NullUUID{UUID: childID, Valid: true}, Facts: f, Book: Template(f),
		CreatedAt: today.AddDate(0, 0, -daysAgo).Add(20 * time.Hour),
	})
	return err
}
