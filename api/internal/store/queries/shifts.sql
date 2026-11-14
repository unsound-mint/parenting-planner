-- name: CreateShift :one
INSERT INTO shifts (family_id, member_id, title, days, start_time, end_time, status, starts_on, round_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- name: ListShifts :many
SELECT * FROM shifts WHERE family_id = $1 ORDER BY created_at, id;

-- name: ListShiftsOfMember :many
SELECT * FROM shifts WHERE family_id = $1 AND member_id = $2;

-- name: ListActiveShifts :many
SELECT * FROM shifts WHERE family_id = $1 AND status = 'active';

-- Turns every agreed shift into an active one starting on the given day.
-- name: ActivateAgreedShifts :exec
UPDATE shifts SET status = 'active', starts_on = $2 WHERE family_id = $1 AND status = 'agreed';
