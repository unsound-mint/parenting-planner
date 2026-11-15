-- name: ListManualCompletions :many
SELECT * FROM manual_completions WHERE family_id = $1 AND member_id = $2;

-- name: CompleteManual :one
-- Keeps the first completion time when the person finishes the manual again.
INSERT INTO manual_completions (family_id, member_id, manual_id, completed_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (family_id, member_id, manual_id) DO UPDATE SET completed_at = manual_completions.completed_at
RETURNING *;
