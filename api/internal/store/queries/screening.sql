-- name: CreateMoodScreening :one
INSERT INTO mood_screenings (family_id, owner_member_id, visibility, taken_at, instrument, answers, score, band, urgent)
VALUES (@family_id, @owner_member_id, @visibility, @taken_at, @instrument, @answers, @score, @band, @urgent)
RETURNING *;

-- Mirrors access.CanParentRead: own results, plus ones shared with the partner or the family.
-- name: ListMoodScreeningsVisibleToParent :many
SELECT * FROM mood_screenings
WHERE family_id = @family_id
  AND taken_at >= @since
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY taken_at DESC;
