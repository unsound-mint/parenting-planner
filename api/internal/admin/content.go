// Package admin is the content admin for one demo copy. There is no admin
// login: every visitor edits their own family's copy, stored as overrides
// with family_id over the catalog in code, so nobody changes what another
// visitor sees. Partner offers are edited through internal/offers.
package admin

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// ErrNoItem means the slug is not in the catalog for that kind.
var ErrNoItem = errors.New("no such content item")

// ContentItem is a catalog item as this family sees it.
type ContentItem struct {
	content.Item
	Edited    bool
	UpdatedAt *time.Time
}

// Edits loads the family's changes to the catalog. Every family-facing
// reader of editable content applies them with content.Edits.
func Edits(ctx context.Context, q *store.Queries, familyID uuid.UUID) (content.Edits, error) {
	rows, err := q.ListContentOverrides(ctx, familyID)
	if err != nil {
		return nil, err
	}
	out := content.Edits{}
	for _, r := range rows {
		out[content.ItemKey{Kind: content.ItemKind(r.Kind), ID: r.ItemID}] = content.Edit{Title: r.Title, Body: r.Body, UpdatedAt: r.UpdatedAt}
	}
	return out, nil
}

// ListContent returns every catalog item of a kind with the family's edits.
func ListContent(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, kind content.ItemKind) ([]ContentItem, error) {
	edits, err := Edits(ctx, store.New(pool), familyID)
	if err != nil {
		return nil, err
	}
	items := content.Items(kind)
	out := make([]ContentItem, 0, len(items))
	for _, it := range items {
		out = append(out, withEdit(it, edits))
	}
	return out, nil
}

// UpdateContent stores the family's title or body for one item; nil keeps
// the current text. now is the family's clock.
func UpdateContent(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, kind content.ItemKind, id string, title, body *string, now time.Time) (ContentItem, error) {
	it, ok := content.FindItem(kind, id)
	if !ok {
		return ContentItem{}, ErrNoItem
	}
	r, err := store.New(pool).UpsertContentOverride(ctx, store.UpsertContentOverrideParams{
		FamilyID: familyID, Kind: string(kind), ItemID: id, Title: title, Body: body, UpdatedAt: now,
	})
	if err != nil {
		return ContentItem{}, err
	}
	return withEdit(it, content.Edits{{Kind: kind, ID: id}: {Title: r.Title, Body: r.Body, UpdatedAt: r.UpdatedAt}}), nil
}

// ResetContent drops the family's edit and returns the catalog version.
func ResetContent(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, kind content.ItemKind, id string) (ContentItem, error) {
	it, ok := content.FindItem(kind, id)
	if !ok {
		return ContentItem{}, ErrNoItem
	}
	err := store.New(pool).DeleteContentOverride(ctx, store.DeleteContentOverrideParams{FamilyID: familyID, Kind: string(kind), ItemID: id})
	return ContentItem{Item: it}, err
}

func withEdit(it content.Item, edits content.Edits) ContentItem {
	ed, ok := edits[content.ItemKey{Kind: it.Kind, ID: it.ID}]
	if !ok {
		return ContentItem{Item: it}
	}
	at := ed.UpdatedAt
	return ContentItem{Item: edits.Item(it), Edited: true, UpdatedAt: &at}
}
