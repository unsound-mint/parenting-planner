package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/unsound-mint/parenting-planner/api/internal/guidance"
)

// ListGuidanceSources needs no session: the sources page is public, like the
// guidelines it lists. Cards do not show sources; this list is where they live.
func (s *Server) ListGuidanceSources(_ context.Context, _ ListGuidanceSourcesRequestObject) (ListGuidanceSourcesResponseObject, error) {
	src := guidance.Sources()
	items := make([]GuidanceSource, len(src))
	for i, e := range src {
		items[i] = GuidanceSource{
			Topic:        GuidanceSourceTopic(e.Topic),
			Organization: e.Organization,
			Title:        e.Title,
			Url:          e.URL,
			CheckedAt:    openapi_types.Date{Time: e.CheckedAt},
		}
	}
	return ListGuidanceSources200JSONResponse{Items: items}, nil
}
