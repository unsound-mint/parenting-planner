-- Missions and stickers are family-scoped; both parents see them (not sensitive).

-- name: ListMissionPicks :many
SELECT * FROM mission_picks WHERE family_id = @family_id;

-- name: GetMissionPickForUpdate :one
SELECT * FROM mission_picks WHERE family_id = @family_id AND mission_key = @mission_key FOR UPDATE;

-- Re-taking a swapped mission is allowed: the row becomes taken again.
-- name: TakeMissionPick :one
INSERT INTO mission_picks (family_id, mission_key, status, task_id)
VALUES (@family_id, @mission_key, 'taken', @task_id)
ON CONFLICT (family_id, mission_key) DO UPDATE SET status = 'taken', task_id = EXCLUDED.task_id, note = NULL
WHERE mission_picks.status = 'swapped'
RETURNING *;

-- name: SwapMissionPick :exec
INSERT INTO mission_picks (family_id, mission_key, status)
VALUES (@family_id, @mission_key, 'swapped')
ON CONFLICT (family_id, mission_key) DO UPDATE SET status = 'swapped', task_id = NULL, note = NULL;

-- name: SetMissionNote :exec
UPDATE mission_picks SET note = @note WHERE family_id = @family_id AND mission_key = @mission_key;

-- name: DeleteTask :exec
DELETE FROM tasks WHERE id = @id AND family_id = @family_id;

-- name: ListStickers :many
SELECT * FROM stickers WHERE family_id = @family_id ORDER BY earned_at, key;

-- name: CreateSticker :one
INSERT INTO stickers (family_id, member_id, key, earned_at, seen_at)
VALUES (@family_id, @member_id, @key, @earned_at, @seen_at)
ON CONFLICT (member_id, key) DO NOTHING
RETURNING *;

-- name: MarkStickerSeen :one
UPDATE stickers SET seen_at = COALESCE(seen_at, @at)
WHERE family_id = @family_id AND member_id = @member_id AND key = @key
RETURNING *;
