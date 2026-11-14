package httpapi

import (
	"context"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/upgrade"
)

func (s *Server) CreateUpgradeIntent(ctx context.Context, req CreateUpgradeIntentRequestObject) (CreateUpgradeIntentResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return CreateUpgradeIntent401JSONResponse(errNoSession), nil
	}
	in, err := upgrade.Request(ctx, s.pool, familyID, string(req.Body.Tier), s.now(ctx))
	if err != nil {
		return nil, err
	}
	return CreateUpgradeIntent201JSONResponse(upgradeIntentOut(in)), nil
}

func upgradeIntentOut(in store.UpgradeIntent) UpgradeIntent {
	return UpgradeIntent{Tier: PaidTier(in.Tier), RequestedAt: in.RequestedAt.UTC()}
}
