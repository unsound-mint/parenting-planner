// Package invitations lets a parent invite a grandparent or nanny with a
// one-time token. Every action is written to audit_log in the same
// transaction. No email is sent: the web app shows a link built from the token.
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

const entity = "invitation"

var (
	ErrNotFound = errors.New("no such invitation")
	// ErrGone means the invitation was accepted, revoked or has expired.
	ErrGone = errors.New("invitation is no longer valid")
)

// Status is derived from the row, never stored.
func Status(inv store.Invitation, now time.Time) string {
	switch {
	case inv.AcceptedAt.Valid:
		return "accepted"
	case inv.RevokedAt.Valid:
		return "revoked"
	case !now.Before(inv.ExpiresAt):
		return "expired"
	}
	return "pending"
}

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
			FamilyID: familyID, CreatedBy: parentID, Role: role, DisplayName: name,
			Permissions: permissions, TokenHash: hash, ExpiresAt: now.Add(TTL),
		})
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, parentID, access.ActionCreate, entity, inv.ID.String())
	})
	return inv, token, err
}

// List returns the family's invitations, newest first.
func List(ctx context.Context, pool *pgxpool.Pool, familyID, parentID uuid.UUID) ([]store.Invitation, error) {
	var out []store.Invitation
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		out, err = q.ListInvitations(ctx, familyID)
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, parentID, access.ActionRead, entity, "")
	})
	return out, err
}

// Revoke cancels an invitation that has not been accepted.
func Revoke(ctx context.Context, pool *pgxpool.Pool, familyID, parentID, id uuid.UUID, now time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.RevokeInvitation(ctx, store.RevokeInvitationParams{ID: id, FamilyID: familyID, RevokedAt: pgtype.Timestamptz{Time: now, Valid: true}})
		if err != nil {
			return err
		}
		if n == 0 {
			// Unknown, another family's, already accepted or already revoked.
			if _, err := q.GetInvitation(ctx, store.GetInvitationParams{ID: id, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			} else if err != nil {
				return err
			}
			return ErrGone
		}
		return access.Audit(ctx, q, familyID, parentID, access.ActionDelete, entity, id.String())
	})
}

// Accept turns a valid token into a caregiver and opens a session for the
// family. It returns the caregiver and the raw session token for the cookie.
func Accept(ctx context.Context, pool *pgxpool.Pool, token string, now time.Time) (store.Caregiver, string, error) {
	var cg store.Caregiver
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
		if Status(inv, now) != "pending" {
			return ErrGone
		}
		cg, err = q.CreateCaregiverWithPermissions(ctx, store.CreateCaregiverWithPermissionsParams{
			FamilyID: inv.FamilyID, Role: inv.Role, DisplayName: inv.DisplayName, Permissions: inv.Permissions,
		})
		if err != nil {
			return err
		}
		if err := q.MarkInvitationAccepted(ctx, store.MarkInvitationAcceptedParams{ID: inv.ID, AcceptedAt: pgtype.Timestamptz{Time: now, Valid: true}}); err != nil {
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
		// The actor is the invitee, who is not a member: the row has no actor id.
		id := inv.ID.String()
		return q.InsertAudit(ctx, store.InsertAuditParams{FamilyID: inv.FamilyID, Action: access.ActionUpdate, Entity: entity, EntityID: &id})
	})
	return cg, sessionToken, err
}
