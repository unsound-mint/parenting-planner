-- name: CreateInvitation :one
INSERT INTO invitations (family_id, created_by, role, display_name, permissions, token_hash, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: ListInvitations :many
SELECT * FROM invitations WHERE family_id = $1 ORDER BY created_at DESC;

-- name: GetInvitation :one
SELECT * FROM invitations WHERE id = $1 AND family_id = $2;

-- name: RevokeInvitation :execrows
UPDATE invitations SET revoked_at = $3
WHERE id = $1 AND family_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL;

-- Locks the row so a token cannot be accepted twice at the same time.
-- name: GetInvitationByTokenForUpdate :one
SELECT * FROM invitations WHERE token_hash = $1 FOR UPDATE;

-- name: MarkInvitationAccepted :exec
UPDATE invitations SET accepted_at = $2 WHERE id = $1;

-- name: CreateCaregiverWithPermissions :one
INSERT INTO caregivers (family_id, role, display_name, permissions) VALUES ($1, $2, $3, $4) RETURNING *;
