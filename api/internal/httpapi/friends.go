package httpapi

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/friends"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errNoFriendCode       = Error{Code: "code_not_found", Message: "no family has this code, or it expired"}
	errOwnFriendCode      = Error{Code: "own_code", Message: "this is your own family's code"}
	errAlreadyFriends     = Error{Code: "already_connected", Message: "your families are already connected or one of you asked"}
	errNoFriendConnection = Error{Code: "not_found", Message: "no such friend family"}
	errNoFriendUpdate     = Error{Code: "not_found", Message: "no such update"}
)

// Friend families are parent-only: actingMember resolves mother and partner,
// so a grandparent or nanny gets 404 on every handler here.

func (s *Server) GetFriends(ctx context.Context, req GetFriendsRequestObject) (GetFriendsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetFriends401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetFriends404JSONResponse(errNoMember), nil
	}
	o, err := friends.Load(ctx, s.q, familyID, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := Friends{Families: make([]FriendFamily, 0, len(o.Connections)), Updates: make([]FriendUpdate, 0, len(o.Updates))}
	if o.Code != nil {
		out.Code = &FriendCode{Code: o.Code.Code, ExpiresAt: o.Code.ExpiresAt.UTC()}
	}
	for _, c := range o.Connections {
		out.Families = append(out.Families, friendFamilyOut(c))
	}
	for _, u := range o.Updates {
		out.Updates = append(out.Updates, friendUpdateOut(u, req.MemberId))
	}
	return GetFriends200JSONResponse(out), nil
}

func (s *Server) CreateFriendCode(ctx context.Context, req CreateFriendCodeRequestObject) (CreateFriendCodeResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateFriendCode401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateFriendCode404JSONResponse(errNoMember), nil
	}
	c, err := friends.NewCode(ctx, s.q, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	return CreateFriendCode201JSONResponse(FriendCode{Code: c.Code, ExpiresAt: c.ExpiresAt.UTC()}), nil
}

func (s *Server) CreateFriendConnection(ctx context.Context, req CreateFriendConnectionRequestObject) (CreateFriendConnectionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateFriendConnection401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateFriendConnection404JSONResponse(errNoMember), nil
	}
	id, err := friends.Connect(ctx, s.pool, familyID, req.MemberId, req.Body.Code, s.now(ctx))
	switch {
	case errors.Is(err, friends.ErrCodeNotFound):
		return CreateFriendConnection404JSONResponse(errNoFriendCode), nil
	case errors.Is(err, friends.ErrOwnCode):
		return CreateFriendConnection409JSONResponse(errOwnFriendCode), nil
	case errors.Is(err, friends.ErrAlreadyConnected):
		return CreateFriendConnection409JSONResponse(errAlreadyFriends), nil
	case err != nil:
		return nil, err
	}
	c, ok, err := s.friendConnection(ctx, familyID, id)
	if err != nil || !ok {
		return nil, fmt.Errorf("friend connection %s vanished: %w", id, err)
	}
	return CreateFriendConnection201JSONResponse(c), nil
}

func (s *Server) AcceptFriendConnection(ctx context.Context, req AcceptFriendConnectionRequestObject) (AcceptFriendConnectionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return AcceptFriendConnection401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return AcceptFriendConnection404JSONResponse(errNoMember), nil
	}
	if err := friends.Accept(ctx, s.q, familyID, req.ConnectionId, s.now(ctx)); errors.Is(err, friends.ErrNotFound) {
		return AcceptFriendConnection404JSONResponse(errNoFriendConnection), nil
	} else if err != nil {
		return nil, err
	}
	c, ok, err := s.friendConnection(ctx, familyID, req.ConnectionId)
	if err != nil || !ok {
		return nil, fmt.Errorf("friend connection %s vanished: %w", req.ConnectionId, err)
	}
	return AcceptFriendConnection200JSONResponse(c), nil
}

func (s *Server) DeleteFriendConnection(ctx context.Context, req DeleteFriendConnectionRequestObject) (DeleteFriendConnectionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteFriendConnection401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteFriendConnection404JSONResponse(errNoMember), nil
	}
	if err := friends.Disconnect(ctx, s.pool, familyID, req.ConnectionId); errors.Is(err, friends.ErrNotFound) {
		return DeleteFriendConnection404JSONResponse(errNoFriendConnection), nil
	} else if err != nil {
		return nil, err
	}
	return DeleteFriendConnection204Response{}, nil
}

func (s *Server) CreateFriendUpdate(ctx context.Context, req CreateFriendUpdateRequestObject) (CreateFriendUpdateResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateFriendUpdate401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateFriendUpdate404JSONResponse(errNoMember), nil
	}
	var headline *string
	if req.Body.Kind == Week {
		state, _, err := s.contentState(ctx, familyID)
		if err != nil {
			return nil, err
		}
		h := weekHeadline(state)
		headline = &h
	}
	u, err := friends.Share(ctx, s.q, familyID, req.MemberId, string(req.Body.Kind), headline, req.Body.Body, s.now(ctx))
	if err != nil {
		return nil, err
	}
	return CreateFriendUpdate201JSONResponse(friendUpdateOut(friends.Update{
		ListFriendUpdatesRow: store.ListFriendUpdatesRow{
			ID: u.ID, FamilyID: u.FamilyID, AuthorMemberID: u.AuthorMemberID, Kind: u.Kind, Headline: u.Headline, Body: u.Body, CreatedAt: u.CreatedAt, AuthorName: m.DisplayName,
		},
		Mine: true, FamilyNames: []string{},
	}, req.MemberId)), nil
}

func (s *Server) DeleteFriendUpdate(ctx context.Context, req DeleteFriendUpdateRequestObject) (DeleteFriendUpdateResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteFriendUpdate401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteFriendUpdate404JSONResponse(errNoMember), nil
	}
	if err := friends.Unshare(ctx, s.q, familyID, req.MemberId, req.UpdateId); errors.Is(err, friends.ErrNotFound) {
		return DeleteFriendUpdate404JSONResponse(errNoFriendUpdate), nil
	} else if err != nil {
		return nil, err
	}
	return DeleteFriendUpdate204Response{}, nil
}

func (s *Server) SetFriendReaction(ctx context.Context, req SetFriendReactionRequestObject) (SetFriendReactionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SetFriendReaction401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SetFriendReaction404JSONResponse(errNoMember), nil
	}
	if err := friends.React(ctx, s.q, familyID, req.MemberId, req.UpdateId, string(req.Body.Reaction), s.now(ctx)); errors.Is(err, friends.ErrNotFound) {
		return SetFriendReaction404JSONResponse(errNoFriendUpdate), nil
	} else if err != nil {
		return nil, err
	}
	return SetFriendReaction204Response{}, nil
}

func (s *Server) DeleteFriendReaction(ctx context.Context, req DeleteFriendReactionRequestObject) (DeleteFriendReactionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteFriendReaction401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteFriendReaction404JSONResponse(errNoMember), nil
	}
	if err := friends.React(ctx, s.q, familyID, req.MemberId, req.UpdateId, "", s.now(ctx)); errors.Is(err, friends.ErrNotFound) {
		return DeleteFriendReaction404JSONResponse(errNoFriendUpdate), nil
	} else if err != nil {
		return nil, err
	}
	return DeleteFriendReaction204Response{}, nil
}

func (s *Server) friendConnection(ctx context.Context, familyID, id uuid.UUID) (FriendFamily, bool, error) {
	o, err := friends.Load(ctx, s.q, familyID, s.now(ctx))
	if err != nil {
		return FriendFamily{}, false, err
	}
	for _, c := range o.Connections {
		if c.ID == id {
			return friendFamilyOut(c), true, nil
		}
	}
	return FriendFamily{}, false, nil
}

// weekHeadline is the line the server writes on a shared week card: where the
// family is, nothing more.
func weekHeadline(s content.State) string {
	switch {
	case s.Stage == "pregnancy" && s.HasWeek:
		return fmt.Sprintf("Week %d of pregnancy", s.Week)
	case s.HasChild && s.AgeMonths < 1:
		return "The first weeks"
	case s.HasChild && s.AgeMonths < 24:
		if s.AgeMonths == 1 {
			return "1 month old"
		}
		return fmt.Sprintf("%d months old", s.AgeMonths)
	case s.HasChild:
		return fmt.Sprintf("%d years old", s.AgeMonths/12)
	}
	return "This week"
}

func friendFamilyOut(c friends.Connection) FriendFamily {
	return FriendFamily{ConnectionId: c.ID, Names: c.Names, Status: FriendFamilyStatus(c.Status), Since: c.Since.UTC()}
}

func friendUpdateOut(u friends.Update, viewer uuid.UUID) FriendUpdate {
	out := FriendUpdate{
		Id: u.ID, Mine: u.Mine, ConnectionId: u.ConnectionID, FamilyNames: u.FamilyNames, AuthorName: u.AuthorName,
		AuthoredByMe: u.AuthorMemberID == viewer, Kind: FriendUpdateKind(u.Kind), Headline: u.Headline, Body: u.Body,
		CreatedAt: u.CreatedAt.UTC(), Reactions: make([]FriendReaction, 0, len(u.Reactions)),
	}
	for _, r := range u.Reactions {
		out.Reactions = append(out.Reactions, FriendReaction{Name: r.DisplayName, Reaction: FriendReactionKind(r.Reaction)})
		if r.MemberID == viewer {
			k := FriendReactionKind(r.Reaction)
			out.MyReaction = &k
		}
	}
	return out
}
