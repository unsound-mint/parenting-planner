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

-- Mirrors access.CanParentRead: not a read for a viewer. Demo maintenance for "Skip ahead a
-- week": each row is copied forward to the same owner with the same visibility, so nothing
-- is shown to anyone new, and the seeded story (a low-mood pattern in the last week) still
-- shows after the skip.
-- name: CopyMoodCheckinsForwardVisibleToParent :exec
INSERT INTO mood_checkins (family_id, owner_member_id, visibility, recorded_at, mood, energy, sleep_hours, note)
SELECT m.family_id, m.owner_member_id, m.visibility, m.recorded_at + make_interval(days => @days::int), m.mood, m.energy, m.sleep_hours, m.note
FROM mood_checkins m
WHERE m.family_id = @family_id AND m.recorded_at >= @from_at AND m.recorded_at < @to_at;
