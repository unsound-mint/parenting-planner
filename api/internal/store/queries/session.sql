-- name: CreateSession :exec
INSERT INTO sessions (token_hash, family_id, expires_at) VALUES ($1, $2, $3);

-- name: GetSessionFamily :one
SELECT s.family_id, f.demo_offset_days
FROM sessions s JOIN families f ON f.id = s.family_id
WHERE s.token_hash = $1 AND s.expires_at > now();
