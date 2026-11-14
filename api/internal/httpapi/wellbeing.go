package httpapi

// REFERENCE HANDLERS: copy this file's shape for new /members/{memberId}/... endpoints.

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/wellbeing"
)

func (s *Server) CreateMoodCheckin(ctx context.Context, req CreateMoodCheckinRequestObject) (CreateMoodCheckinResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateMoodCheckin401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateMoodCheckin404JSONResponse(errNoMember), nil
	}
	b := req.Body
	c, err := wellbeing.CreateMoodCheckin(ctx, s.pool, familyID, req.MemberId, wellbeing.NewMoodCheckin{
		Mood: int16(b.Mood), Energy: int16(b.Energy), SleepHours: float64(b.SleepHours), Note: b.Note,
		Visibility: access.Visibility(b.Visibility), RecordedAt: s.cfg.Now(),
	})
	if err != nil {
		return nil, err
	}
	return CreateMoodCheckin201JSONResponse(moodCheckinOut(c)), nil
}

func (s *Server) ListMoodCheckins(ctx context.Context, req ListMoodCheckinsRequestObject) (ListMoodCheckinsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListMoodCheckins401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListMoodCheckins404JSONResponse(errNoMember), nil
	}
	rows, err := wellbeing.ListMoodCheckins(ctx, s.pool, familyID, req.MemberId, s.cfg.Now())
	if err != nil {
		return nil, err
	}
	out := MoodCheckinList{Items: make([]MoodCheckin, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, moodCheckinOut(r))
	}
	return ListMoodCheckins200JSONResponse(out), nil
}

// Mapping from store rows to API types lives next to the handlers that use it.
func moodCheckinOut(c store.MoodCheckin) MoodCheckin {
	return MoodCheckin{
		Id: c.ID, AuthorId: c.OwnerMemberID, RecordedAt: c.RecordedAt.UTC(),
		Mood: int(c.Mood), Energy: int(c.Energy), SleepHours: float32(c.SleepHours),
		Note: c.Note, Visibility: Visibility(c.Visibility),
	}
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
	e, err := wellbeing.CreateDiaryEntry(ctx, s.pool, familyID, req.MemberId, wellbeing.NewDiaryEntry{
		Body: req.Body.Body, Visibility: access.Visibility(req.Body.Visibility), WrittenAt: s.cfg.Now(),
	})
	if err != nil {
		return nil, err
	}
	return CreateDiaryEntry201JSONResponse(diaryEntryOut(e)), nil
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
	rows, err := wellbeing.ListDiaryEntries(ctx, s.pool, familyID, req.MemberId, s.cfg.Now())
	if err != nil {
		return nil, err
	}
	out := DiaryEntryList{Items: make([]DiaryEntry, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, diaryEntryOut(r))
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
	e, err := wellbeing.ShareDiaryEntry(ctx, s.pool, familyID, req.MemberId, req.EntryId, access.Visibility(req.Body.Visibility))
	if errors.Is(err, wellbeing.ErrNotAuthor) {
		return UpdateDiaryEntry404JSONResponse(errNoDiaryEntry), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateDiaryEntry200JSONResponse(diaryEntryOut(e)), nil
}

func diaryEntryOut(e store.DiaryEntry) DiaryEntry {
	return DiaryEntry{
		Id: e.ID, AuthorId: e.OwnerMemberID, WrittenAt: e.WrittenAt.UTC(),
		Body: e.Body, Visibility: Visibility(e.Visibility),
	}
}
