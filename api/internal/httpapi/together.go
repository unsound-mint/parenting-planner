package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/together"
)

// The couple card, talks and names are parents only: actingMember answers 404
// for a caregiver.

var (
	errUnknownPrompt = Error{Code: "unknown_prompt", Message: "no such talk prompt for this family"}
	errNameExists    = Error{Code: "name_exists", Message: "this name is already on the list"}
	errEmptyName     = Error{Code: "invalid_request", Message: "the name is empty"}
	errNoBabyName    = Error{Code: "not_found", Message: "no such name on this family's list"}
)

func (s *Server) GetTogether(ctx context.Context, req GetTogetherRequestObject) (GetTogetherResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetTogether401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetTogether404JSONResponse(errNoMember), nil
	}
	st, _, other, _, err := s.learnCouple(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	card, err := together.GetCard(ctx, s.pool, familyID, req.MemberId, other, st, s.today(ctx), s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := Together{Prompts: make([]TalkPrompt, 0, len(card.Prompts)), ClosedNudgeIds: card.Closed}
	if n := card.Nudge; n != nil {
		out.Nudge = &PartnerNudge{Id: n.Key, MemberId: n.MemberID, Kind: PartnerNudgeKind(n.Kind), At: n.At.UTC(), Text: n.Text}
		if n.LessonID != "" {
			id := n.LessonID
			out.Nudge.LessonId = &id
		}
		if n.Name != "" {
			name := n.Name
			out.Nudge.Name = &name
		}
	}
	for _, p := range card.Prompts {
		tp := TalkPrompt{Id: p.ID, Text: p.Text}
		if p.LessonID != "" {
			id := p.LessonID
			tp.LessonId = &id
		}
		if p.TalkedAt != nil {
			at, by := p.TalkedAt.UTC(), p.TalkedBy
			tp.TalkedAt, tp.TalkedBy = &at, &by
		}
		out.Prompts = append(out.Prompts, tp)
	}
	return GetTogether200JSONResponse(out), nil
}

func (s *Server) CreateCoupleTalk(ctx context.Context, req CreateCoupleTalkRequestObject) (CreateCoupleTalkResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateCoupleTalk401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateCoupleTalk404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	t, err := together.Talk(ctx, s.pool, familyID, req.MemberId, st, req.Body.PromptId, s.now(ctx))
	switch {
	case errors.Is(err, together.ErrUnknownPrompt):
		return CreateCoupleTalk404JSONResponse(errUnknownPrompt), nil
	case err != nil:
		return nil, err
	}
	return CreateCoupleTalk201JSONResponse(CoupleTalk{PromptId: t.PromptID, TalkedBy: t.TalkedBy, TalkedAt: t.TalkedAt.UTC()}), nil
}

func (s *Server) ListBabyNames(ctx context.Context, req ListBabyNamesRequestObject) (ListBabyNamesResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListBabyNames401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListBabyNames404JSONResponse(errNoMember), nil
	}
	_, _, _, parents, err := s.learnCouple(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	names, err := together.ListNames(ctx, s.pool, familyID, parents)
	if err != nil {
		return nil, err
	}
	out := BabyNameList{Items: make([]BabyName, 0, len(names))}
	for _, n := range names {
		out.Items = append(out.Items, babyNameOut(n))
	}
	return ListBabyNames200JSONResponse(out), nil
}

func (s *Server) CreateBabyName(ctx context.Context, req CreateBabyNameRequestObject) (CreateBabyNameResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateBabyName401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateBabyName404JSONResponse(errNoMember), nil
	}
	_, _, _, parents, err := s.learnCouple(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	n, err := together.AddName(ctx, s.pool, familyID, req.MemberId, parents, req.Body.Name, s.now(ctx))
	switch {
	case errors.Is(err, together.ErrEmptyName):
		return CreateBabyName400JSONResponse(errEmptyName), nil
	case errors.Is(err, together.ErrNameExists):
		return CreateBabyName409JSONResponse(errNameExists), nil
	case err != nil:
		return nil, err
	}
	return CreateBabyName201JSONResponse(babyNameOut(n)), nil
}

func (s *Server) LikeBabyName(ctx context.Context, req LikeBabyNameRequestObject) (LikeBabyNameResponseObject, error) {
	n, kind, err := s.setBabyNameLike(ctx, req.MemberId, req.NameId, true)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return LikeBabyName401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return LikeBabyName404JSONResponse(errNoMember), nil
	case n == nil:
		return LikeBabyName404JSONResponse(errNoBabyName), nil
	}
	return LikeBabyName200JSONResponse(babyNameOut(*n)), nil
}

func (s *Server) UnlikeBabyName(ctx context.Context, req UnlikeBabyNameRequestObject) (UnlikeBabyNameResponseObject, error) {
	n, kind, err := s.setBabyNameLike(ctx, req.MemberId, req.NameId, false)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UnlikeBabyName401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UnlikeBabyName404JSONResponse(errNoMember), nil
	case n == nil:
		return UnlikeBabyName404JSONResponse(errNoBabyName), nil
	}
	return UnlikeBabyName200JSONResponse(babyNameOut(*n)), nil
}

// setBabyNameLike is shared by like and unlike; a nil name means it is not on
// this family's list.
func (s *Server) setBabyNameLike(ctx context.Context, memberID MemberId, nameID BabyNameId, like bool) (*together.Name, errKind, error) {
	familyID, _, kind, err := s.actingMember(ctx, memberID)
	if err != nil || kind != errNone {
		return nil, kind, err
	}
	_, _, _, parents, err := s.learnCouple(ctx, familyID, memberID)
	if err != nil {
		return nil, errNone, err
	}
	n, err := together.SetLike(ctx, s.pool, familyID, memberID, parents, nameID, like, s.now(ctx))
	if errors.Is(err, together.ErrUnknownName) {
		return nil, errNone, nil
	}
	if err != nil {
		return nil, errNone, err
	}
	return &n, errNone, nil
}

func babyNameOut(n together.Name) BabyName {
	return BabyName{Id: n.ID, Name: n.Name, AddedBy: n.AddedBy, LikedBy: n.LikedBy, BothLike: n.BothLike, CreatedAt: n.CreatedAt.UTC()}
}

func (s *Server) CreateNudgeDismissal(ctx context.Context, req CreateNudgeDismissalRequestObject) (CreateNudgeDismissalResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateNudgeDismissal401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateNudgeDismissal404JSONResponse(errNoMember), nil
	}
	if err := together.Dismiss(ctx, s.pool, familyID, req.MemberId, req.Body.Id, s.now(ctx)); err != nil {
		return nil, err
	}
	return CreateNudgeDismissal204Response{}, nil
}
