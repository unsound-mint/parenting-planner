-- name: CreateMoodCheckin :one
INSERT INTO mood_checkins (family_id, owner_member_id, visibility, recorded_at, mood, energy, sleep_hours, note)
VALUES (@family_id, @owner_member_id, @visibility, @recorded_at, @mood, @energy, @sleep_hours, @note)
RETURNING *;

-- Mirrors access.CanParentRead: own check-ins, plus ones shared with the partner or the family.
-- name: ListMoodCheckinsVisibleToParent :many
SELECT * FROM mood_checkins
WHERE family_id = @family_id
  AND recorded_at >= @since
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY recorded_at DESC;
