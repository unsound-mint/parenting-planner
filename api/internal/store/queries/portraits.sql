-- Uploading to a taken slot replaces it: the domain deletes the slot first.
-- name: DeletePortraitSlot :exec
DELETE FROM portraits
WHERE family_id = @family_id
  AND child_id IS NOT DISTINCT FROM sqlc.narg(child_id)::uuid
  AND month IS NOT DISTINCT FROM sqlc.narg(month)::smallint
  AND week IS NOT DISTINCT FROM sqlc.narg(week)::smallint;

-- name: CreatePortrait :one
INSERT INTO portraits (family_id, child_id, month, week, kind, uploader_member_id, width, height, image, created_at)
VALUES (@family_id, sqlc.narg(child_id), sqlc.narg(month), sqlc.narg(week), @kind, sqlc.narg(uploader_member_id),
        sqlc.narg(width), sqlc.narg(height), sqlc.narg(image), @created_at)
RETURNING id, family_id, child_id, month, week, kind, uploader_member_id, width, height, created_at;

-- Metadata only, never the image. Mirrors portraits.Person.CanSee: parents
-- pass both flags true; a caregiver passes @sees_children for baby_passport and
-- @sees_bump for pregnancy_updates. Newest moment first.
-- name: ListPortraits :many
SELECT id, family_id, child_id, month, week, kind, uploader_member_id, width, height, created_at
FROM portraits
WHERE family_id = @family_id
  AND ((child_id IS NOT NULL AND @sees_children::bool) OR (child_id IS NULL AND @sees_bump::bool))
ORDER BY (child_id IS NULL), month DESC NULLS LAST, week DESC NULLS LAST;

-- A photo's bytes, with the same filter as ListPortraits.
-- name: GetPortraitImage :one
SELECT id, image FROM portraits
WHERE id = @id AND family_id = @family_id AND kind = 'photo'
  AND ((child_id IS NOT NULL AND @sees_children::bool) OR (child_id IS NULL AND @sees_bump::bool));

-- name: DeletePortrait :execrows
DELETE FROM portraits WHERE id = @id AND family_id = @family_id;

-- Starting a new demo from a browser drops the photos of the family it leaves.
-- name: DeleteFamilyPhotos :execrows
DELETE FROM portraits WHERE family_id = @family_id AND kind = 'photo';
