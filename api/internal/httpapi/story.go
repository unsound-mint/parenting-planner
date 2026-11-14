package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/story"
)

// GetStory is the family's memory book. Parents and caregivers may read it;
// story.Load decides what each one's edition holds.
func (s *Server) GetStory(ctx context.Context, req GetStoryRequestObject) (GetStoryResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetStory401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetStory404JSONResponse(errNoMember), nil
	}
	st, err := story.Load(ctx, s.pool, s.cfg.Diary, familyID, story.Viewer{ID: m.ID, Role: m.Role, Permissions: m.Permissions}, s.now(ctx), s.today(ctx))
	if err != nil {
		return nil, err
	}
	return GetStory200JSONResponse(storyOut(st)), nil
}

func storyOut(st story.Story) Story {
	out := Story{Chapters: make([]StoryChapter, 0, len(st.Chapters)), Next: make([]StoryInvitation, 0, len(st.Next))}
	for _, c := range st.Chapters {
		ch := StoryChapter{
			Kind: StoryChapterKind(c.Kind), Title: c.Title, StartsOn: openapi_types.Date{Time: c.StartsOn},
			Current: c.Current, Stage: Stage(c.Stage), Span: optional(c.Span), Comparison: optional(c.Comparison),
			Moments: make([]StoryMoment, 0, len(c.Moments)),
		}
		if c.EndsOn != nil {
			ch.EndsOn = &openapi_types.Date{Time: *c.EndsOn}
		}
		for _, m := range c.Moments {
			mo := StoryMoment{
				Id: m.ID, Kind: StoryMomentKind(m.Kind), On: openapi_types.Date{Time: m.On}, Title: m.Title,
				Detail: optional(m.Detail), Quote: optional(m.Quote), Comparison: optional(m.Comparison),
				PeopleIds: m.People,
			}
			if m.First {
				mo.First = &m.First
			}
			if m.Week > 0 {
				mo.Week = &m.Week
			}
			if m.Count > 0 {
				mo.Count = &m.Count
			}
			if len(m.Sources) > 0 {
				src := make([]Source, 0, len(m.Sources))
				for _, s := range m.Sources {
					src = append(src, sourceOut(s))
				}
				mo.Sources = &src
			}
			ch.Moments = append(ch.Moments, mo)
		}
		out.Chapters = append(out.Chapters, ch)
	}
	for _, n := range st.Next {
		inv := StoryInvitation{Kind: StoryMomentKind(n.Kind), Title: n.Title}
		if n.On != nil {
			inv.On = &openapi_types.Date{Time: *n.On}
		}
		out.Next = append(out.Next, inv)
	}
	return out
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
