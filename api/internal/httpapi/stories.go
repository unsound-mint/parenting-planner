package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/storybook"
)

var (
	errNoStory         = Error{Code: "not_found", Message: "no such story"}
	errStoryVisibility = Error{Code: "invalid_visibility", Message: "a story is private or shared with the partner"}
	errStoryChild      = Error{Code: "invalid_child", Message: "pick a child of this family or give a name"}
	errStoryMemory     = Error{Code: "invalid_memory", Message: "add at least one memory with words in it"}
)

// signedAsFor is what a child calls the author when the parent does not say.
func signedAsFor(role string) string {
	if role == "mother" {
		return "Mommy"
	}
	return "Daddy"
}

func storybookOut(s storybook.Story) StorybookStory {
	out := StorybookStory{
		Id: s.ID, AuthorId: s.OwnerMemberID, Title: s.Title, Theme: StoryTheme(s.Theme), ChildName: s.ChildName,
		SignedAs: s.SignedAs, Memories: s.MemoryLines, Pages: make([]StoryPage, 0, len(s.PageList)),
		Visibility: Visibility(s.Visibility), GeneratedBy: StorybookStoryGeneratedBy(s.GeneratedBy), CreatedAt: s.CreatedAt.UTC(),
	}
	if out.Memories == nil {
		out.Memories = []string{}
	}
	if s.ChildID.Valid {
		out.ChildId = &s.ChildID.UUID
	}
	if s.AgeMonths.Valid {
		age := int(s.AgeMonths.Int32)
		out.AgeMonths = &age
	}
	for _, p := range s.PageList {
		out.Pages = append(out.Pages, StoryPage{Text: p.Text, Art: StoryArt(p.Art)})
	}
	return out
}

func (s *Server) CreateStory(ctx context.Context, req CreateStoryRequestObject) (CreateStoryResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateStory401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateStory404JSONResponse(errNoMember), nil
	}
	b := req.Body
	if !storybook.Shareable(access.Visibility(b.Visibility)) {
		return CreateStory400JSONResponse(errStoryVisibility), nil
	}
	var (
		childID uuid.NullUUID
		name    string
		age     *int
	)
	if b.ChildId != nil {
		children, err := s.q.ListChildren(ctx, familyID)
		if err != nil {
			return nil, err
		}
		for _, c := range children {
			if c.ID == *b.ChildId {
				childID = uuid.NullUUID{UUID: c.ID, Valid: true}
				name = c.Name
				months := max(monthsBetween(c.BirthDate, s.today(ctx)), 0)
				age = &months
			}
		}
		if !childID.Valid {
			return CreateStory400JSONResponse(errStoryChild), nil
		}
	} else if b.ChildName != nil {
		name = *b.ChildName
	}
	if storybook.FirstName(name) == "" {
		return CreateStory400JSONResponse(errStoryChild), nil
	}
	signed := signedAsFor(m.Role)
	if b.SignedAs != nil && storybook.FirstName(*b.SignedAs) != "" {
		signed = *b.SignedAs
	}
	memories := make([]string, 0, len(b.Memories))
	for _, mem := range b.Memories {
		memories = append(memories, mem.Text)
	}
	facts, err := storybook.NewFacts(name, age, storybook.Theme(b.Theme), signed, memories)
	if err != nil {
		return CreateStory400JSONResponse(errStoryMemory), nil
	}
	book := storybook.NewWriter(s.cfg.AI).Write(ctx, facts)
	st, err := storybook.Create(ctx, s.pool, familyID, req.MemberId, storybook.New{
		Visibility: access.Visibility(b.Visibility), ChildID: childID, Facts: facts, Book: book, CreatedAt: s.now(ctx),
	})
	if err != nil {
		return nil, err
	}
	return CreateStory201JSONResponse(storybookOut(st)), nil
}

func (s *Server) ListStories(ctx context.Context, req ListStoriesRequestObject) (ListStoriesResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListStories401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListStories404JSONResponse(errNoMember), nil
	}
	rows, err := storybook.List(ctx, s.pool, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	out := StoryList{Items: make([]StorybookStory, 0, len(rows)), AiEnabled: s.cfg.AI.Enabled()}
	for _, r := range rows {
		out.Items = append(out.Items, storybookOut(r))
	}
	return ListStories200JSONResponse(out), nil
}

func (s *Server) GetStorybookStory(ctx context.Context, req GetStorybookStoryRequestObject) (GetStorybookStoryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetStorybookStory401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetStorybookStory404JSONResponse(errNoMember), nil
	}
	st, err := storybook.Get(ctx, s.pool, familyID, req.MemberId, req.StoryId)
	if errors.Is(err, storybook.ErrNoStory) {
		return GetStorybookStory404JSONResponse(errNoStory), nil
	}
	if err != nil {
		return nil, err
	}
	return GetStorybookStory200JSONResponse(storybookOut(st)), nil
}

func (s *Server) UpdateStory(ctx context.Context, req UpdateStoryRequestObject) (UpdateStoryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateStory401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateStory404JSONResponse(errNoMember), nil
	}
	v := access.Visibility(req.Body.Visibility)
	if !storybook.Shareable(v) {
		return UpdateStory400JSONResponse(errStoryVisibility), nil
	}
	st, err := storybook.SetVisibility(ctx, s.pool, familyID, req.MemberId, req.StoryId, v)
	if errors.Is(err, storybook.ErrNoStory) {
		return UpdateStory404JSONResponse(errNoStory), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateStory200JSONResponse(storybookOut(st)), nil
}

func (s *Server) DeleteStory(ctx context.Context, req DeleteStoryRequestObject) (DeleteStoryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteStory401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteStory404JSONResponse(errNoMember), nil
	}
	err = storybook.Delete(ctx, s.pool, familyID, req.MemberId, req.StoryId)
	if errors.Is(err, storybook.ErrNoStory) {
		return DeleteStory404JSONResponse(errNoStory), nil
	}
	if err != nil {
		return nil, err
	}
	return DeleteStory204Response{}, nil
}
