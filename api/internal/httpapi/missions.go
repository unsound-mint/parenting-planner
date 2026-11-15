package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/badges"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/missions"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Missions and stickers are parents only (actingMember answers 404 for a
// caregiver). They are not sensitive records: both parents see every mission,
// and a sticker book is read per parent. No sticker comes from health data.

var (
	errNoMission    = Error{Code: "not_found", Message: "no such mission"}
	errMissionTaken = Error{Code: "mission_taken", Message: "this mission is already taken"}
	errWrongStage   = Error{Code: "wrong_stage", Message: "this mission is not offered at your stage"}
	errNotTaken     = Error{Code: "not_taken", Message: "take this mission first"}
	errMissionDone  = Error{Code: "mission_done", Message: "a finished mission cannot be put back"}
	errNoSticker    = Error{Code: "not_found", Message: "no such sticker earned"}
)

func missionOut(v missions.View) Mission {
	m := Mission{
		Key: v.Key, Stage: MissionStage(v.Stage), Title: v.Title, Why: v.Why, Category: MissionCategory(v.Category),
		ForPartner: v.Partner, State: MissionState(v.State), Note: v.Note, DoneAt: v.DoneAt,
	}
	if v.TakenBy != nil {
		m.TakenBy = v.TakenBy
	}
	m.TaskId = v.TaskID
	m.DoneBy = v.DoneByID
	if v.DueOn != nil {
		m.DueOn = &openapi_types.Date{Time: *v.DueOn}
	}
	if v.Source != nil {
		s := sourceOut(*v.Source)
		m.Source = &s
	}
	return m
}

// parentIDs lists the family's parents, oldest member first (mother, partner).
func (s *Server) parentIDs(ctx context.Context, familyID uuid.UUID) ([]uuid.UUID, error) {
	ms, err := s.q.ListMembers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(ms))
	for _, m := range ms {
		ids = append(ids, m.ID)
	}
	return ids, nil
}

// syncStickers stores the stickers the family's state now earns. A failure
// here must not fail the request that triggered it: the sticker book syncs
// again on every read.
func (s *Server) syncStickers(ctx context.Context, familyID uuid.UUID) {
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return
	}
	parents, err := s.parentIDs(ctx, familyID)
	if err != nil {
		return
	}
	_ = badges.Sync(ctx, s.q, familyID, st, parents, s.now(ctx))
}

func (s *Server) ListMissions(ctx context.Context, req ListMissionsRequestObject) (ListMissionsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListMissions401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListMissions404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	stage := missions.StageOf(st)
	items, err := missions.List(ctx, s.pool, familyID, stage, content.CalendarWeek(s.today(ctx)))
	if err != nil {
		return nil, err
	}
	out := MissionList{Stage: MissionListStage(stage), Items: make([]Mission, 0, len(items))}
	for _, v := range items {
		out.Items = append(out.Items, missionOut(v))
	}
	return ListMissions200JSONResponse(out), nil
}

func (s *Server) TakeMission(ctx context.Context, req TakeMissionRequestObject) (TakeMissionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return TakeMission401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return TakeMission404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	v, err := missions.Take(ctx, s.pool, familyID, req.MemberId, missions.StageOf(st), req.MissionKey, s.today(ctx), s.now(ctx))
	switch {
	case errors.Is(err, missions.ErrUnknown):
		return TakeMission404JSONResponse(errNoMission), nil
	case errors.Is(err, missions.ErrWrongStage):
		return TakeMission409JSONResponse(errWrongStage), nil
	case errors.Is(err, missions.ErrTaken):
		return TakeMission409JSONResponse(errMissionTaken), nil
	case err != nil:
		return nil, err
	}
	return TakeMission201JSONResponse(missionOut(v)), nil
}

func (s *Server) FinishMission(ctx context.Context, req FinishMissionRequestObject) (FinishMissionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return FinishMission401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return FinishMission404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	parents, err := s.parentIDs(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var note *string
	if req.Body != nil {
		note = req.Body.Note
	}
	now := s.now(ctx)
	v, err := missions.Done(ctx, s.pool, familyID, req.MemberId, missions.StageOf(st), req.MissionKey, note, now,
		func(ctx context.Context, q *store.Queries) error {
			return badges.Sync(ctx, q, familyID, st, parents, now)
		})
	switch {
	case errors.Is(err, missions.ErrUnknown):
		return FinishMission404JSONResponse(errNoMission), nil
	case errors.Is(err, missions.ErrNotTaken):
		return FinishMission409JSONResponse(errNotTaken), nil
	case err != nil:
		return nil, err
	}
	return FinishMission200JSONResponse(missionOut(v)), nil
}

func (s *Server) SwapMission(ctx context.Context, req SwapMissionRequestObject) (SwapMissionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SwapMission401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SwapMission404JSONResponse(errNoMember), nil
	}
	err = missions.Swap(ctx, s.pool, familyID, req.MemberId, req.MissionKey, s.now(ctx))
	switch {
	case errors.Is(err, missions.ErrUnknown):
		return SwapMission404JSONResponse(errNoMission), nil
	case errors.Is(err, missions.ErrIsDone):
		return SwapMission409JSONResponse(errMissionDone), nil
	case err != nil:
		return nil, err
	}
	return SwapMission204Response{}, nil
}

func (s *Server) ListStickers(ctx context.Context, req ListStickersRequestObject) (ListStickersResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListStickers401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListStickers404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	parents, err := s.parentIDs(ctx, familyID)
	if err != nil {
		return nil, err
	}
	book, err := badges.Book(ctx, s.pool, familyID, req.MemberId, st, parents, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := StickerBook{Items: make([]Sticker, 0, len(book))}
	for _, b := range book {
		it := Sticker{Key: b.Key, Title: b.Title, Blurb: b.Blurb, Art: b.Art, Group: StickerGroup(b.Group), Earned: b.Earned, EarnedAt: b.EarnedAt, New: b.New}
		if b.PathID != "" {
			p := b.PathID
			it.PathId = &p
		}
		out.Items = append(out.Items, it)
	}
	return ListStickers200JSONResponse(out), nil
}

func (s *Server) MarkStickerSeen(ctx context.Context, req MarkStickerSeenRequestObject) (MarkStickerSeenResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return MarkStickerSeen401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return MarkStickerSeen404JSONResponse(errNoMember), nil
	}
	err = badges.MarkSeen(ctx, s.pool, familyID, req.MemberId, req.StickerKey, s.now(ctx))
	switch {
	case errors.Is(err, badges.ErrUnknownSticker):
		return MarkStickerSeen404JSONResponse(errNoSticker), nil
	case err != nil:
		return nil, err
	}
	return MarkStickerSeen204Response{}, nil
}
