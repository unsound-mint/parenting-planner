// Package invitations lets a parent invite a grandparent or nanny with a
// one-time token. Every event is written to audit_log in the same
// transaction; the access log endpoint reads it back. No email is sent: the
// web app shows a link built from the token.
package invitations

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// TTL is how long an invitation can be accepted.
const TTL = 7 * 24 * time.Hour

// Entity is the audit entity name of an invitation.
const Entity = "invitation"

var (
	ErrNotFound = errors.New("no such invitation")
	// ErrNotPending: accepting an invitation that is accepted, revoked or expired.
	ErrNotPending = errors.New("invitation is not pending")
	// ErrNotActive: revoking an invitation that is already revoked or expired.
	ErrNotActive = errors.New("invitation is not active")
)

type Status string

const (
	Pending  Status = "pending"
	Accepted Status = "accepted"
	Revoked  Status = "revoked"
	Expired  Status = "expired"
)

// StatusOf is derived from the row: expired is never stored.
func StatusOf(inv store.Invitation, now time.Time) Status {
	switch {
	case inv.RevokedAt.Valid:
		return Revoked
	case inv.AcceptedAt.Valid:
		return Accepted
	case !now.Before(inv.ExpiresAt):
		return Expired
	}
	return Pending
}

func ts(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }

// Create stores an invitation and returns it with the raw token. The token is
// not stored and cannot be read again.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, parentID uuid.UUID, role, name string, permissions []string, now time.Time) (store.Invitation, string, error) {
	token, hash, err := demo.NewToken()
	if err != nil {
		return store.Invitation{}, "", err
	}
	var inv store.Invitation
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		inv, err = q.CreateInvitation(ctx, store.CreateInvitationParams{
			FamilyID: familyID, InvitedBy: parentID, Role: role, DisplayName: name,
			Permissions: permissions, TokenHash: hash, ExpiresAt: now.Add(TTL),
		})
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, parentID, access.ActionCreate, Entity, inv.ID.String())
	})
	return inv, token, err
}

func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) ([]store.Invitation, error) {
	return store.New(pool).ListInvitations(ctx, familyID)
}

// Revoke cancels a pending invitation or removes an accepted caregiver's access.
func Revoke(ctx context.Context, pool *pgxpool.Pool, familyID, parentID, id uuid.UUID, now time.Time) (store.Invitation, error) {
	var inv store.Invitation
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		inv, err = q.GetInvitationForUpdate(ctx, store.GetInvitationForUpdateParams{ID: id, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if s := StatusOf(inv, now); s != Pending && s != Accepted {
			return ErrNotActive
		}
		if err := q.MarkInvitationRevoked(ctx, store.MarkInvitationRevokedParams{ID: id, RevokedAt: ts(now)}); err != nil {
			return err
		}
		if inv.MemberID.Valid {
			// The caregiver stays as a row so the access log can still name them, but cannot act.
			if err := q.RevokeCaregiver(ctx, store.RevokeCaregiverParams{ID: inv.MemberID.UUID, FamilyID: familyID, RevokedAt: ts(now)}); err != nil {
				return err
			}
		}
		inv.RevokedAt = ts(now)
		return access.Audit(ctx, q, familyID, parentID, access.ActionRevoke, Entity, id.String())
	})
	return inv, err
}

// Preview is what the accept page shows. It works for any status.
func Preview(ctx context.Context, pool *pgxpool.Pool, token string) (store.GetInvitationByTokenRow, error) {
	row, err := store.New(pool).GetInvitationByToken(ctx, demo.HashToken(token))
	if errors.Is(err, pgx.ErrNoRows) {
		return row, ErrNotFound
	}
	return row, err
}

// Accept turns a pending token into a caregiver and opens a session for the
// family. It returns the family id, the new member and the raw session token.
func Accept(ctx context.Context, pool *pgxpool.Pool, token string, now time.Time) (uuid.UUID, store.Member, string, error) {
	var familyID uuid.UUID
	var cg store.Member
	var sessionToken string
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		inv, err := q.GetInvitationByTokenForUpdate(ctx, demo.HashToken(token))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if StatusOf(inv, now) != Pending {
			return ErrNotPending
		}
		familyID = inv.FamilyID
		cg, err = q.CreateCaregiver(ctx, store.CreateCaregiverParams{
			FamilyID: inv.FamilyID, Role: inv.Role, DisplayName: inv.DisplayName, Permissions: inv.Permissions,
		})
		if err != nil {
			return err
		}
		if err := q.MarkInvitationAccepted(ctx, store.MarkInvitationAcceptedParams{ID: inv.ID, AcceptedAt: ts(now), MemberID: uuid.NullUUID{UUID: cg.ID, Valid: true}}); err != nil {
			return err
		}
		var hash []byte
		sessionToken, hash, err = demo.NewToken()
		if err != nil {
			return err
		}
		if err := q.CreateSession(ctx, store.CreateSessionParams{TokenHash: hash, FamilyID: inv.FamilyID, ExpiresAt: now.Add(demo.SessionTTL)}); err != nil {
			return err
		}
		return access.Audit(ctx, q, inv.FamilyID, cg.ID, access.ActionAccept, Entity, inv.ID.String())
	})
	return familyID, cg, sessionToken, err
}

// AccessLog lists caregiver activity and invitation events of the last 30 days.
func AccessLog(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, now time.Time) ([]store.ListAccessLogRow, error) {
	return store.New(pool).ListAccessLog(ctx, store.ListAccessLogParams{FamilyID: familyID, At: now.AddDate(0, 0, -30)})
}
