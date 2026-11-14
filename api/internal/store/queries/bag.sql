-- name: CreateBagItem :one
INSERT INTO bag_items (family_id, list, label, packer_member_id) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: ListBagItems :many
SELECT * FROM bag_items WHERE family_id = $1 ORDER BY list, created_at, label;

-- name: UpdateBagItem :one
UPDATE bag_items
SET packed = COALESCE(sqlc.narg(packed), packed),
    packer_member_id = COALESCE(sqlc.narg(packer_member_id), packer_member_id)
WHERE id = $1 AND family_id = $2
RETURNING *;
