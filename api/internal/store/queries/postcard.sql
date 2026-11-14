-- The postcard holds only what parents chose to share and hearts from the
-- family's own caregivers; it never reads a record with an owner or a
-- visibility, so nothing here mirrors access.CanParentRead.

-- name: GetPostcardLine :one
SELECT * FROM postcard_lines WHERE family_id = @family_id AND period_key = @period_key;

-- name: UpsertPostcardLine :one
INSERT INTO postcard_lines (family_id, period_key, author_member_id, author_name, body, updated_at)
VALUES (@family_id, @period_key, @author_member_id, @author_name, @body, @updated_at)
ON CONFLICT (family_id, period_key) DO UPDATE
SET author_member_id = EXCLUDED.author_member_id, author_name = EXCLUDED.author_name,
    body = EXCLUDED.body, updated_at = EXCLUDED.updated_at
RETURNING *;

-- name: DeletePostcardLine :exec
DELETE FROM postcard_lines WHERE family_id = @family_id AND period_key = @period_key;

-- name: CreatePostcardLove :one
INSERT INTO postcard_loves (family_id, from_member_id, message, created_at)
VALUES (@family_id, @from_member_id, @message, @created_at)
RETURNING *;

-- Every heart the family received since @since; from_member_id narrows to one
-- grandparent when set.
-- name: ListPostcardLoves :many
SELECT l.id, l.from_member_id, m.display_name AS from_name, l.message, l.created_at
FROM postcard_loves l
JOIN members m ON m.id = l.from_member_id
WHERE l.family_id = @family_id
  AND l.created_at >= @since
  AND (sqlc.narg('from_member_id')::uuid IS NULL OR l.from_member_id = sqlc.narg('from_member_id')::uuid)
ORDER BY l.created_at DESC, l.id DESC
LIMIT 20;
