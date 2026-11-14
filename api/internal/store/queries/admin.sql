-- name: ListContentOverrides :many
SELECT * FROM content_overrides WHERE family_id = @family_id;

-- A field left null keeps the earlier edit, or the catalog's text.
-- name: UpsertContentOverride :one
INSERT INTO content_overrides AS o (family_id, kind, item_id, title, body, updated_at)
VALUES (@family_id, @kind, @item_id, sqlc.narg(title), sqlc.narg(body), @updated_at)
ON CONFLICT (family_id, kind, item_id) DO UPDATE SET
    title      = coalesce(EXCLUDED.title, o.title),
    body       = coalesce(EXCLUDED.body, o.body),
    updated_at = EXCLUDED.updated_at
RETURNING *;

-- name: DeleteContentOverride :exec
DELETE FROM content_overrides WHERE family_id = @family_id AND kind = @kind AND item_id = @item_id;
