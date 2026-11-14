-- name: CreateVirtualBabySession :one
INSERT INTO virtual_baby_sessions (family_id, mode, started_by, started_at, finished_at)
VALUES (@family_id, @mode, @started_by, @started_at, sqlc.narg('finished_at'))
RETURNING *;

-- name: ListVirtualBabySessions :many
SELECT * FROM virtual_baby_sessions
WHERE family_id = @family_id
ORDER BY (finished_at IS NULL) DESC, started_at DESC
LIMIT @max_rows;

-- name: GetVirtualBabySessionForUpdate :one
SELECT * FROM virtual_baby_sessions
WHERE id = @id AND family_id = @family_id
FOR UPDATE;

-- name: FinishVirtualBabySession :one
UPDATE virtual_baby_sessions SET finished_at = @finished_at
WHERE id = @id AND family_id = @family_id AND finished_at IS NULL
RETURNING *;

-- name: CreateVirtualBabyMoment :execrows
INSERT INTO virtual_baby_moments (session_id, family_id, seq, scenario_id, choice_id, handled_by, handled_at)
VALUES (@session_id, @family_id, @seq, @scenario_id, @choice_id, @handled_by, @handled_at)
ON CONFLICT (session_id, seq) DO NOTHING;

-- name: ListVirtualBabyMoments :many
SELECT * FROM virtual_baby_moments
WHERE family_id = @family_id AND session_id = ANY(@session_ids::uuid[])
ORDER BY session_id, seq;
