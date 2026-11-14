-- name: CreateCareLogEntry :one
INSERT INTO care_log_entries (family_id, child_id, author_member_id, kind, started_at, ended_at, feed_method, amount_ml, diaper, note)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: ListCareLogEntries :many
SELECT * FROM care_log_entries
WHERE family_id = @family_id AND started_at >= @since
  AND (sqlc.narg(kind)::text IS NULL OR kind = sqlc.narg(kind)::text)
ORDER BY started_at DESC, created_at DESC;

-- name: LatestCareLogEntry :one
SELECT * FROM care_log_entries WHERE family_id = $1 AND kind = $2 ORDER BY started_at DESC, created_at DESC LIMIT 1;

-- created_at comes from the caller (the family's demo clock), not the database
-- default: ListHandoffs filters on it with the same clock.
-- name: CreateHandoff :one
INSERT INTO handoffs (family_id, from_member_id, to_member_id, note, shift_id, created_at)
VALUES (@family_id, @from_member_id, @to_member_id, @note, @shift_id, @created_at) RETURNING *;

-- Attaches the uploader's own unattached note. Zero rows: someone else's, already
-- attached, or gone.
-- name: AttachVoiceNoteToHandoff :execrows
UPDATE voice_notes SET handoff_id = @handoff_id
WHERE id = @voice_note_id AND family_id = @family_id AND uploader_member_id = @uploader_id AND handoff_id IS NULL;

-- Metadata only, never the audio.
-- name: ListHandoffVoiceNotes :many
SELECT id, handoff_id, content_type, size_bytes, duration_seconds, created_at FROM voice_notes
WHERE family_id = @family_id AND handoff_id = ANY(@handoff_ids::uuid[]);

-- name: ListHandoffs :many
SELECT * FROM handoffs
WHERE family_id = @family_id AND created_at >= @since
  AND (sqlc.narg(involving)::uuid IS NULL OR from_member_id = sqlc.narg(involving)::uuid OR to_member_id = sqlc.narg(involving)::uuid)
ORDER BY (status = 'pending') DESC, created_at DESC;

-- name: CountPendingHandoffsFrom :one
SELECT count(*) FROM handoffs WHERE family_id = $1 AND from_member_id = $2 AND status = 'pending';

-- Locks the row so a handoff cannot be accepted twice at once.
-- name: GetHandoffForUpdate :one
SELECT * FROM handoffs WHERE id = $1 AND family_id = $2 FOR UPDATE;

-- name: AcceptHandoff :one
UPDATE handoffs SET status = 'accepted', accepted_at = $2 WHERE id = $1 RETURNING *;

-- name: LastAcceptedHandoff :one
SELECT * FROM handoffs WHERE family_id = $1 AND status = 'accepted' ORDER BY accepted_at DESC LIMIT 1;
