package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/invitations"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func invitationOut(inv store.Invitation, s *Server) Invitation {
	perms := make([]CaregiverPermission, 0, len(inv.Permissions))
	for _, p := range inv.Permissions {
		perms = append(perms, CaregiverPermission(p))
	}
	return Invitation{
		Id: inv.ID, Role: CaregiverRole(inv.Role), DisplayName: inv.DisplayName, Permissions: perms,
		Status: InvitationStatus(invitations.Status(inv, s.cfg.Now())), ExpiresAt: inv.ExpiresAt,
	}
}

func (s *Server) CreateInvitation(ctx context.Context, req CreateInvitationRequestObject) (CreateInvitationResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateInvitation401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateInvitation404JSONResponse(errNoMember), nil
	}
	b := req.Body
	perms := make([]string, 0, len(b.Permissions))
	for _, p := range b.Permissions {
		perms = append(perms, string(p))
	}
	inv, token, err := invitations.Create(ctx, s.pool, familyID, req.MemberId, string(b.Role), b.DisplayName, perms, s.cfg.Now())
	if err != nil {
		return nil, err
	}
	out := invitationOut(inv, s)
	out.Token = &token
	return CreateInvitation201JSONResponse(out), nil
}

func (s *Server) ListInvitations(ctx context.Context, req ListInvitationsRequestObject) (ListInvitationsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListInvitations401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListInvitations404JSONResponse(errNoMember), nil
	}
	rows, err := invitations.List(ctx, s.pool, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	items := make([]Invitation, 0, len(rows))
	for _, r := range rows {
		items = append(items, invitationOut(r, s))
	}
	return ListInvitations200JSONResponse{Items: items}, nil
}

func (s *Server) RevokeInvitation(ctx context.Context, req RevokeInvitationRequestObject) (RevokeInvitationResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return RevokeInvitation401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return RevokeInvitation404JSONResponse(errNoMember), nil
	}
	err = invitations.Revoke(ctx, s.pool, familyID, req.MemberId, uuid.UUID(req.InvitationId), s.cfg.Now())
	switch {
	case errors.Is(err, invitations.ErrNotFound), errors.Is(err, invitations.ErrGone):
		return RevokeInvitation404JSONResponse(errNoInvitation), nil
	case err != nil:
		return nil, err
	}
	return RevokeInvitation204Response{}, nil
}

func (s *Server) AcceptInvitation(ctx context.Context, req AcceptInvitationRequestObject) (AcceptInvitationResponseObject, error) {
	cg, token, err := invitations.Accept(ctx, s.pool, req.Body.Token, s.cfg.Now())
	switch {
	case errors.Is(err, invitations.ErrNotFound):
		return AcceptInvitation404JSONResponse(errNoInvitation), nil
	case errors.Is(err, invitations.ErrGone):
		return AcceptInvitation410JSONResponse(errInvitationGone), nil
	case err != nil:
		return nil, err
	}
	cookie := (&http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", HttpOnly: true,
		Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: int(demo.SessionTTL.Seconds()),
	}).String()
	return AcceptInvitation201JSONResponse{Body: caregiverOut(cg), Headers: AcceptInvitation201ResponseHeaders{SetCookie: &cookie}}, nil
}
