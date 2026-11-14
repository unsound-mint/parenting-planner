-- name: CreateSession :exec
INSERT INTO sessions (token_hash, family_id, expires_at) VALUES ($1, $2, $3);

-- name: GetSessionFamily :one
SELECT family_id FROM sessions WHERE token_hash = $1 AND expires_at > now();
