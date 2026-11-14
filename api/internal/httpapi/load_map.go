package httpapi

import (
	"context"

	"github.com/google/uuid"
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
	areas, err := loadmap.Load(ctx, s.pool, familyID, m.ID, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := LoadMap{WindowDays: loadmap.WindowDays, Areas: make([]LoadMapArea, 0, len(areas))}
	for _, a := range areas {
		item := LoadMapArea{
			Key: LoadMapAreaKey(a.Key), Label: a.Label, Unit: LoadMapUnit(a.Unit), Owned: shareOut(a.Owned),
			HandoverTaskIds: idsOrEmpty(a.Handover), OfferedToMeTaskIds: idsOrEmpty(a.OfferedToMe), OfferedByMeTaskIds: idsOrEmpty(a.OfferedByMe),
		}
		if a.Started != nil {
			st := shareOut(a.Started)
			item.Started = &st
		}
		out.Areas = append(out.Areas, item)
	}
	return GetLoadMap200JSONResponse(out), nil
}
