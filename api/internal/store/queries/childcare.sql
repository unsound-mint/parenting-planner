-- name: CreateChildcareOption :one
INSERT INTO childcare_options (family_id, name, kind, contact, monthly_cost, status, waitlist_position, applied_on, decide_by, notes, created_at, updated_at)
VALUES (@family_id, @name, @kind, @contact, @monthly_cost, @status, @waitlist_position, @applied_on, @decide_by, @notes, @now, @now)
RETURNING *;

-- name: ListChildcareOptions :many
SELECT * FROM childcare_options
WHERE family_id = @family_id
ORDER BY created_at DESC, id;

-- name: GetChildcareOption :one
SELECT * FROM childcare_options
WHERE id = @id AND family_id = @family_id;

-- name: UpdateChildcareOption :one
UPDATE childcare_options
SET name = @name, kind = @kind, contact = @contact, monthly_cost = @monthly_cost, status = @status,
    waitlist_position = @waitlist_position, applied_on = @applied_on, decide_by = @decide_by, notes = @notes,
    updated_at = @now
WHERE id = @id AND family_id = @family_id
RETURNING *;

-- name: DeleteChildcareOption :execrows
DELETE FROM childcare_options
WHERE id = @id AND family_id = @family_id;
