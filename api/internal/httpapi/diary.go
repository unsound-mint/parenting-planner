package httpapi

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/diary"
)

var (
	errNoDiaryEntry   = Error{Code: "not_found", Message: "no such diary entry"}
	errEmptyDiaryBody = Error{Code: "invalid_request", Message: "the entry text is empty"}
)

// diaryEntryOut shows the agenda topic only on the viewer's own entries: the
// agenda belongs to its author.
func diaryEntryOut(e diary.Entry, viewer uuid.UUID) DiaryEntry {
	out := DiaryEntry{Id: e.ID, AuthorId: e.OwnerMemberID, WrittenAt: e.WrittenAt, Body: e.Body, Visibility: Visibility(e.Visibility), First: e.IsFirst}
	if e.OwnerMemberID == viewer && e.AgendaTopic != nil {
		out.AgendaTopic = e.AgendaTopic
	}
	// The mood is part of the entry: a reader of the entry sees it.
	if e.Mood.Valid {
		m := DiaryMood(e.Mood.Int16)
		out.Mood = &m
	}
	return out
}

func (s *Server) CreateDiaryEntry(ctx context.Context, req CreateDiaryEntryRequestObject) (CreateDiaryEntryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateDiaryEntry401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateDiaryEntry404JSONResponse(errNoMember), nil
	}
	b := req.Body
	e, err := diary.Create(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, diary.New{
		Body: b.Body, Visibility: access.Visibility(b.Visibility), AgendaTopic: b.AgendaTopic, Mood: b.Mood, First: b.First != nil && *b.First, WrittenAt: s.now(ctx),
	})
	if err != nil {
		return nil, err
	}
	return CreateDiaryEntry201JSONResponse(diaryEntryOut(e, req.MemberId)), nil
}

func (s *Server) ListDiaryEntries(ctx context.Context, req ListDiaryEntriesRequestObject) (ListDiaryEntriesResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListDiaryEntries401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListDiaryEntries404JSONResponse(errNoMember), nil
	}
	limit := 0
	if req.Params.Limit != nil {
		limit = *req.Params.Limit
	}
	page, err := diary.List(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, s.now(ctx), req.Params.Before, limit, req.Params.First != nil && *req.Params.First)
	if err != nil {
		return nil, err
	}
	out := DiaryEntryList{Items: make([]DiaryEntry, 0, len(page.Entries)), NextBefore: page.NextBefore}
	for _, r := range page.Entries {
		out.Items = append(out.Items, diaryEntryOut(r, req.MemberId))
	}
	return ListDiaryEntries200JSONResponse(out), nil
}

func (s *Server) UpdateDiaryEntry(ctx context.Context, req UpdateDiaryEntryRequestObject) (UpdateDiaryEntryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateDiaryEntry401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateDiaryEntry404JSONResponse(errNoMember), nil
	}
	b := req.Body
	c := diary.Change{Visibility: access.Visibility(b.Visibility), AgendaTopic: b.AgendaTopic, First: b.First, Mood: b.Mood}
	if b.Body != nil {
		text := strings.TrimSpace(*b.Body)
		if text == "" {
			return UpdateDiaryEntry400JSONResponse(errEmptyDiaryBody), nil
		}
		c.Body = &text
	}
	e, err := diary.Update(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, req.EntryId, c)
	if errors.Is(err, diary.ErrNoEntry) {
		return UpdateDiaryEntry404JSONResponse(errNoDiaryEntry), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateDiaryEntry200JSONResponse(diaryEntryOut(e, req.MemberId)), nil
}

func (s *Server) DeleteDiaryEntry(ctx context.Context, req DeleteDiaryEntryRequestObject) (DeleteDiaryEntryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteDiaryEntry401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteDiaryEntry404JSONResponse(errNoMember), nil
	}
	err = diary.Delete(ctx, s.pool, familyID, req.MemberId, req.EntryId, s.now(ctx))
	if errors.Is(err, diary.ErrNoEntry) {
		return DeleteDiaryEntry404JSONResponse(errNoDiaryEntry), nil
	}
	if err != nil {
		return nil, err
	}
	return DeleteDiaryEntry204Response{}, nil
}
