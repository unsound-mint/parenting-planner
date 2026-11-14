package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/admin"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
)

// The content admin has no login (see openapi.yaml): every handler works on
// the session's own family copy, so a visitor never changes what another sees.

var errNoContentItem = Error{Code: "not_found", Message: "no such content item"}

func (s *Server) ListContentItems(ctx context.Context, req ListContentItemsRequestObject) (ListContentItemsResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return ListContentItems401JSONResponse(errNoSession), nil
	}
	items, err := admin.ListContent(ctx, s.pool, familyID, content.ItemKind(req.Params.Kind))
	if err != nil {
		return nil, err
	}
	out := ContentItemList{Items: make([]ContentItem, 0, len(items))}
	for _, it := range items {
		out.Items = append(out.Items, contentItemOut(it))
	}
	return ListContentItems200JSONResponse(out), nil
}

func (s *Server) UpdateContentItem(ctx context.Context, req UpdateContentItemRequestObject) (UpdateContentItemResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return UpdateContentItem401JSONResponse(errNoSession), nil
	}
	it, err := admin.UpdateContent(ctx, s.pool, familyID, content.ItemKind(req.Kind), req.ItemId, req.Body.Title, req.Body.Body, s.now(ctx))
	switch {
	case errors.Is(err, admin.ErrNoItem):
		return UpdateContentItem404JSONResponse(errNoContentItem), nil
	case err != nil:
		return nil, err
	}
	return UpdateContentItem200JSONResponse(contentItemOut(it)), nil
}

func (s *Server) ResetContentItem(ctx context.Context, req ResetContentItemRequestObject) (ResetContentItemResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return ResetContentItem401JSONResponse(errNoSession), nil
	}
	it, err := admin.ResetContent(ctx, s.pool, familyID, content.ItemKind(req.Kind), req.ItemId)
	switch {
	case errors.Is(err, admin.ErrNoItem):
		return ResetContentItem404JSONResponse(errNoContentItem), nil
	case err != nil:
		return nil, err
	}
	return ResetContentItem200JSONResponse(contentItemOut(it)), nil
}

func contentItemOut(it admin.ContentItem) ContentItem {
	out := ContentItem{Kind: ContentKind(it.Kind), Id: it.ID, Title: it.Title, Body: it.Body, Edited: it.Edited}
	if it.UpdatedAt != nil {
		at := it.UpdatedAt.UTC()
		out.UpdatedAt = &at
	}
	if it.Source != nil {
		src := sourceOut(*it.Source)
		out.Source = &src
	}
	return out
}
