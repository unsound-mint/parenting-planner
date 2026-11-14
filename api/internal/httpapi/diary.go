package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/diary"
)

var errNoDiaryEntry = Error{Code: "not_found", Message: "no such diary entry"}

// diaryEntryOut shows the agenda topic only on the viewer's own entries: the
// agenda belongs to its author.
func diaryEntryOut(e diary.Entry, viewer uuid.UUID) DiaryEntry {
	out := DiaryEntry{Id: e.ID, AuthorId: e.OwnerMemberID, WrittenAt: e.WrittenAt, Body: e.Body, Visibility: Visibility(e.Visibility)}
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
		Body: b.Body, Visibility: access.Visibility(b.Visibility), AgendaTopic: b.AgendaTopic, Mood: b.Mood, WrittenAt: s.now(ctx),
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
	rows, err := diary.List(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := DiaryEntryList{Items: make([]DiaryEntry, 0, len(rows))}
	for _, r := range rows {
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
	e, err := diary.Update(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, req.EntryId, access.Visibility(b.Visibility), b.AgendaTopic)
	if errors.Is(err, diary.ErrNoEntry) {
		return UpdateDiaryEntry404JSONResponse(errNoDiaryEntry), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateDiaryEntry200JSONResponse(diaryEntryOut(e, req.MemberId)), nil
}
