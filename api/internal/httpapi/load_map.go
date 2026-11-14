package httpapi

import (
	"context"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/loadmap"
)

func shareOut(in []loadmap.Share) []LoadMapShare {
	out := make([]LoadMapShare, 0, len(in))
	for _, s := range in {
		out = append(out, LoadMapShare{MemberId: s.MemberID, Count: s.Count, RecentCount: s.RecentCount})
	}
	return out
}

func idsOrEmpty(in []uuid.UUID) []uuid.UUID {
	if in == nil {
		return []uuid.UUID{}
	}
	return in
}

// GetLoadMap counts who carries what. Both parents read the same family data;
// a caregiver gets 403 (the map compares the parents).
func (s *Server) GetLoadMap(ctx context.Context, req GetLoadMapRequestObject) (GetLoadMapResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetLoadMap401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetLoadMap404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return GetLoadMap403JSONResponse(errForbidden), nil
	}
	areas, takers, err := loadmap.Load(ctx, s.pool, familyID, m.ID, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := LoadMap{WindowDays: loadmap.WindowDays, Areas: make([]LoadMapArea, 0, len(areas)), Takers: takers}
	for _, a := range areas {
		item := LoadMapArea{
			Key: LoadMapAreaKey(a.Key), Label: a.Label, Unit: LoadMapUnit(a.Unit), Owned: shareOut(a.Owned),
			HandoverTaskIds: idsOrEmpty(a.Handover), OfferedToMeTaskIds: idsOrEmpty(a.OfferedToMe), OfferedByMeTaskIds: idsOrEmpty(a.OfferedByMe),
			Items: make([]LoadMapItem, 0, len(a.Items)),
		}
		for _, it := range a.Items {
			li := LoadMapItem{TaskId: it.Task.ID, Title: it.Task.Title, Kind: TaskKind(it.Task.Kind), Done: it.Task.Done, AssigneeId: it.Task.AssigneeMemberID, CreatedById: it.Task.CreatedByMemberID, PendingAssigneeId: it.Offered}
			if it.Due != nil {
				li.DueOn = &openapi_types.Date{Time: *it.Due}
			}
			item.Items = append(item.Items, li)
		}
		if a.Started != nil {
			st := shareOut(a.Started)
			item.Started = &st
		}
		out.Areas = append(out.Areas, item)
	}
	return GetLoadMap200JSONResponse(out), nil
}
