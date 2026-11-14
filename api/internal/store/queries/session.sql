-- member_id is NULL for a demo session (it acts as either parent) and the
-- caregiver's id for a session opened by accepting an invitation.
-- name: CreateSession :exec
INSERT INTO sessions (token_hash, family_id, expires_at, member_id) VALUES ($1, $2, $3, $4);

-- Mirrors access.SessionIsLive: a session bound to a member ends once that
-- member's access is revoked (or they left the family).
-- name: GetSessionFamily :one
SELECT s.family_id, s.member_id, m.role AS member_role, f.demo_offset_days
FROM sessions s
JOIN families f ON f.id = s.family_id
LEFT JOIN members m ON m.id = s.member_id AND m.family_id = s.family_id
WHERE s.token_hash = $1 AND s.expires_at > now()
  AND (s.member_id IS NULL OR (m.id IS NOT NULL AND m.revoked_at IS NULL));
