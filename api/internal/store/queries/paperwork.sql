-- name: ListPaperworkItems :many
SELECT * FROM paperwork_items WHERE family_id = $1;

-- name: UpsertPaperworkItem :one
INSERT INTO paperwork_items (family_id, key, done, assignee_member_id)
VALUES ($1, $2, COALESCE(sqlc.narg(done), false), sqlc.narg(assignee_member_id))
ON CONFLICT (family_id, key) DO UPDATE
SET done = COALESCE(sqlc.narg(done), paperwork_items.done),
    assignee_member_id = COALESCE(sqlc.narg(assignee_member_id), paperwork_items.assignee_member_id)
RETURNING *;

-- name: UpdateFamilyDueDate :one
UPDATE families SET due_date = $2 WHERE id = $1 RETURNING *;
