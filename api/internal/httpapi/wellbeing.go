package httpapi

// REFERENCE HANDLERS: copy this file's shape for new /members/{memberId}/... endpoints.

import (
	"context"

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
		Visibility: access.Visibility(b.Visibility), RecordedAt: s.now(ctx),
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
	rows, err := wellbeing.ListMoodCheckins(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
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
