-- Mirrors access.CanParentRead: every letter of the family is listed, so the partner
-- sees that one exists, but the sealed text is returned only to its author or when
-- the author shared it with the partner (the other rows get NULL).
-- name: ListLettersVisibleToParent :many
SELECT id, family_id, owner_member_id, child_id, visibility, occasion, opens_on, created_at, updated_at,
  CASE WHEN owner_member_id = @viewer_id OR visibility IN ('partner', 'family') THEN body_sealed END::bytea AS body_sealed
FROM time_capsule_letters
WHERE family_id = @family_id
ORDER BY opens_on, created_at;

-- name: CreateLetter :one
INSERT INTO time_capsule_letters (family_id, owner_member_id, child_id, visibility, occasion, opens_on, body_sealed, created_at, updated_at)
VALUES (@family_id, @owner_member_id, @child_id, @visibility, @occasion, @opens_on, @body_sealed, @now, @now) RETURNING *;

-- Mirrors access.CanParentRead for a change: only the author, so the partner cannot
-- find a letter through it. Locks the row.
-- name: GetOwnLetterVisibleToParent :one
SELECT * FROM time_capsule_letters WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id FOR UPDATE;

-- Mirrors access.CanParentRead for a change: only the author.
-- name: UpdateOwnLetterVisibleToParent :one
UPDATE time_capsule_letters
SET occasion = @occasion, opens_on = @opens_on, visibility = @visibility, body_sealed = @body_sealed, updated_at = @now
WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id RETURNING *;

-- Mirrors access.CanParentRead for a change: only the author.
-- name: DeleteOwnLetterVisibleToParent :execrows
DELETE FROM time_capsule_letters WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id;
