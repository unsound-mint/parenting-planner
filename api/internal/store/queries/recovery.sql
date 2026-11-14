-- name: CreateRecoveryCheckin :one
INSERT INTO recovery_checkins (family_id, owner_member_id, visibility, recorded_at, bleeding, pain, wound, breasts, pelvic_floor, sleep_hours, mood, warning_signs, note)
VALUES (@family_id, @owner_member_id, @visibility, @recorded_at, @bleeding, @pain, @wound, @breasts, @pelvic_floor, @sleep_hours, @mood, @warning_signs, @note)
RETURNING *;

-- Mirrors access.CanParentRead: own check-ins, plus ones shared with the partner or the family.
-- name: ListRecoveryCheckinsVisibleToParent :many
SELECT * FROM recovery_checkins
WHERE family_id = @family_id
  AND recorded_at >= @since
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY recorded_at DESC, created_at DESC;

-- Mirrors access.CanParentRead for a change: only the author, so the other parent's
-- shared check-in cannot be found (and does not reveal that it exists).
-- name: UpdateOwnRecoveryCheckinVisibleToParent :one
UPDATE recovery_checkins SET visibility = @visibility
WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id RETURNING *;
