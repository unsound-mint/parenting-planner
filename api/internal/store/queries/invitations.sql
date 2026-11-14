-- name: CreateInvitation :one
INSERT INTO invitations (family_id, invited_by, role, display_name, permissions, token_hash, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: ListInvitations :many
SELECT * FROM invitations WHERE family_id = $1 ORDER BY created_at DESC;

-- Locks the row so two requests cannot revoke or accept the same invitation at once.
-- name: GetInvitationForUpdate :one
SELECT * FROM invitations WHERE id = $1 AND family_id = $2 FOR UPDATE;

-- name: GetInvitationByTokenForUpdate :one
SELECT * FROM invitations WHERE token_hash = $1 FOR UPDATE;

-- name: GetInvitationByToken :one
SELECT i.*, m.display_name AS invited_by_name
FROM invitations i JOIN members m ON m.id = i.invited_by
WHERE i.token_hash = $1;

-- name: MarkInvitationAccepted :exec
UPDATE invitations SET accepted_at = $2, member_id = $3 WHERE id = $1;

-- name: MarkInvitationRevoked :exec
UPDATE invitations SET revoked_at = $2 WHERE id = $1;

-- Caregiver activity and invitation events of the last 30 days. A parent's own reads of
-- sensitive records are not caregiver activity, so they never show up here.
-- name: ListAccessLog :many
SELECT a.id, a.actor_member_id, a.action, a.entity, a.entity_id, a.at,
       m.display_name AS actor_name, m.role AS actor_role, m.revoked_at AS actor_revoked_at
FROM audit_log a
LEFT JOIN members m ON m.id = a.actor_member_id
WHERE a.family_id = $1 AND a.at >= $2
  AND (a.entity = 'invitation' OR m.role IN ('grandparent','nanny'))
ORDER BY a.at DESC, a.id DESC
LIMIT 200;
