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

-- Mirrors access.CanParentRead for a change: only the author, so another parent's result
-- cannot be found (and does not reveal that it exists). Locks the row.
-- name: GetOwnMoodScreeningVisibleToParent :one
SELECT * FROM mood_screenings WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id FOR UPDATE;

-- Mirrors access.CanParentRead for a change: only the author.
-- name: UpdateOwnMoodScreeningVisibilityVisibleToParent :one
UPDATE mood_screenings SET visibility = @visibility WHERE id = @id AND owner_member_id = @viewer_id RETURNING *;

-- name: UpsertMoodScreeningDraft :one
INSERT INTO mood_screening_drafts (family_id, owner_member_id, instrument, answers, updated_at)
VALUES (@family_id, @owner_member_id, @instrument, @answers, @updated_at)
ON CONFLICT (owner_member_id, instrument) DO UPDATE SET answers = EXCLUDED.answers, updated_at = EXCLUDED.updated_at
RETURNING *;

-- Mirrors access.CanParentRead: a draft is never shared, so only the author's own are read.
-- Drafts older than the cutoff are not returned.
-- name: ListMoodScreeningDraftsVisibleToParent :many
SELECT * FROM mood_screening_drafts
WHERE family_id = @family_id AND owner_member_id = @viewer_id AND updated_at >= @since
ORDER BY updated_at DESC;

-- name: DeleteMoodScreeningDraft :exec
DELETE FROM mood_screening_drafts WHERE owner_member_id = $1 AND instrument = $2;

-- name: DeleteStaleMoodScreeningDrafts :exec
DELETE FROM mood_screening_drafts WHERE owner_member_id = $1 AND updated_at < $2;
