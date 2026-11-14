package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/wellbeing"
)

func (s *Server) ListMoodPatterns(ctx context.Context, req ListMoodPatternsRequestObject) (ListMoodPatternsResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListMoodPatterns401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListMoodPatterns404JSONResponse(errNoMember), nil
	}
	patterns, err := wellbeing.ListMoodPatterns(ctx, s.pool, familyID, m, s.today(ctx), s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := MoodPatternList{Items: make([]MoodPattern, 0, len(patterns))}
	for _, p := range patterns {
		out.Items = append(out.Items, MoodPattern{
			Kind: MoodPatternKind(p.Kind), StartedOn: openapi_types.Date{Time: p.StartedOn}, Days: p.Days,
			CheckinIds: p.CheckinIDs, Message: p.Message, ProviderType: ProviderType(p.ProviderType),
			Source: Source{Title: p.Source.Title, Url: p.Source.URL, CheckedAt: openapi_types.Date{Time: p.Source.CheckedAt}},
		})
	}
	return ListMoodPatterns200JSONResponse(out), nil
}
