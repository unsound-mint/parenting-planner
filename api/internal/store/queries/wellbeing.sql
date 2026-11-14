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

-- name: CreateDiaryEntry :one
INSERT INTO diary_entries (family_id, owner_member_id, visibility, written_at, body)
VALUES (@family_id, @owner_member_id, @visibility, @written_at, @body)
RETURNING *;

-- Mirrors access.CanParentRead: own entries, plus ones shared with the partner or the family.
-- name: ListDiaryEntriesVisibleToParent :many
SELECT * FROM diary_entries
WHERE family_id = @family_id
  AND written_at >= @since
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY written_at DESC;

-- Only the author may change who sees an entry; anyone else matches no row.
-- name: UpdateDiaryEntryVisibility :one
UPDATE diary_entries SET visibility = @visibility
WHERE id = @id AND family_id = @family_id AND owner_member_id = @owner_member_id
RETURNING *;
