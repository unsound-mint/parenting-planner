package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/invitations"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func (s *Server) invitationOut(inv store.Invitation) Invitation {
	out := Invitation{
		Id: inv.ID, Role: CaregiverRole(inv.Role), DisplayName: inv.DisplayName, Permissions: permissionsOut(inv.Permissions),
		Status: InvitationStatus(invitations.StatusOf(inv, s.cfg.Now())), InvitedById: inv.InvitedBy,
		CreatedAt: inv.CreatedAt, ExpiresAt: inv.ExpiresAt,
	}
	if inv.MemberID.Valid {
		id := inv.MemberID.UUID
		out.MemberId = &id
	}
	if inv.AcceptedAt.Valid {
		out.AcceptedAt = &inv.AcceptedAt.Time
	}
	if inv.RevokedAt.Valid {
		out.RevokedAt = &inv.RevokedAt.Time
	}
	return out
}

func permissionStrings(in []CaregiverPermission) []string {
	out := make([]string, 0, len(in))
	for _, p := range in {
		out = append(out, string(p))
	}
	return out
}

func (s *Server) CreateInvitation(ctx context.Context, req CreateInvitationRequestObject) (CreateInvitationResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateInvitation401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateInvitation404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return CreateInvitation403JSONResponse(errForbidden), nil
	}
	b := req.Body
	inv, token, err := invitations.Create(ctx, s.pool, familyID, req.MemberId, string(b.Role), b.DisplayName, permissionStrings(b.Permissions), s.cfg.Now())
	if err != nil {
		return nil, err
	}
	return CreateInvitation201JSONResponse{Invitation: s.invitationOut(inv), Token: token, Path: "/invite/" + token}, nil
}

func (s *Server) ListInvitations(ctx context.Context, req ListInvitationsRequestObject) (ListInvitationsResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListInvitations401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListInvitations404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return ListInvitations403JSONResponse(errForbidden), nil
	}
	rows, err := invitations.List(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	items := make([]Invitation, 0, len(rows))
	for _, r := range rows {
		items = append(items, s.invitationOut(r))
	}
	return ListInvitations200JSONResponse{Items: items}, nil
}

func (s *Server) RevokeInvitation(ctx context.Context, req RevokeInvitationRequestObject) (RevokeInvitationResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return RevokeInvitation401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return RevokeInvitation404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return RevokeInvitation403JSONResponse(errForbidden), nil
	}
	inv, err := invitations.Revoke(ctx, s.pool, familyID, req.MemberId, req.InvitationId, s.cfg.Now())
	switch {
	case errors.Is(err, invitations.ErrNotFound):
		return RevokeInvitation404JSONResponse(errNoInvitation), nil
	case errors.Is(err, invitations.ErrNotActive):
		return RevokeInvitation409JSONResponse(errInvitationNotActive), nil
	case err != nil:
		return nil, err
	}
	return RevokeInvitation200JSONResponse(s.invitationOut(inv)), nil
}

func (s *Server) GetInvitation(ctx context.Context, req GetInvitationRequestObject) (GetInvitationResponseObject, error) {
	row, err := invitations.Preview(ctx, s.pool, req.Token)
	if errors.Is(err, invitations.ErrNotFound) {
		return GetInvitation404JSONResponse(errNoInvitation), nil
	}
	if err != nil {
		return nil, err
	}
	inv := store.Invitation{AcceptedAt: row.AcceptedAt, RevokedAt: row.RevokedAt, ExpiresAt: row.ExpiresAt}
	return GetInvitation200JSONResponse{
		Role: CaregiverRole(row.Role), DisplayName: row.DisplayName, Permissions: permissionsOut(row.Permissions),
		Status: InvitationStatus(invitations.StatusOf(inv, s.cfg.Now())), InvitedByName: row.InvitedByName, ExpiresAt: row.ExpiresAt,
	}, nil
}

func (s *Server) AcceptInvitation(ctx context.Context, req AcceptInvitationRequestObject) (AcceptInvitationResponseObject, error) {
	familyID, cg, token, err := invitations.Accept(ctx, s.pool, req.Token, s.cfg.Now())
	switch {
	case errors.Is(err, invitations.ErrNotFound):
		return AcceptInvitation404JSONResponse(errNoInvitation), nil
	case errors.Is(err, invitations.ErrNotPending):
		return AcceptInvitation409JSONResponse(errInvitationNotPending), nil
	case err != nil:
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	cookie := (&http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", HttpOnly: true,
		Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: int(demo.SessionTTL.Seconds()),
	}).String()
	return AcceptInvitation201JSONResponse{
		Body:    InvitationAcceptance{Family: fam, MemberId: cg.ID},
		Headers: AcceptInvitation201ResponseHeaders{SetCookie: &cookie},
	}, nil
}

func (s *Server) ListAccessLogEntries(ctx context.Context, req ListAccessLogEntriesRequestObject) (ListAccessLogEntriesResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListAccessLogEntries401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListAccessLogEntries404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return ListAccessLogEntries403JSONResponse(errForbidden), nil
	}
	rows, err := invitations.AccessLog(ctx, s.pool, familyID, s.cfg.Now())
	if err != nil {
		return nil, err
	}
	items := make([]AccessLogEntry, 0, len(rows))
	for _, r := range rows {
		e := AccessLogEntry{Id: itoa(r.ID), Action: r.Action, Entity: r.Entity, At: r.At}
		if r.ActorMemberID.Valid {
			if !r.ActorRevokedAt.Valid {
				id := r.ActorMemberID.UUID
				e.ActorId = &id
			}
			e.ActorName = "Removed person"
			if r.ActorName != nil {
				e.ActorName = *r.ActorName
			}
			if r.ActorRole != nil {
				role := PersonRole(*r.ActorRole)
				e.ActorRole = &role
			}
		} else {
			e.ActorName = "Removed person"
		}
		e.EntityId = r.EntityID
		items = append(items, e)
	}
	return ListAccessLogEntries200JSONResponse{Items: items}, nil
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }
