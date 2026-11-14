-- name: CreateFamily :one
INSERT INTO families (template, stage, due_date) VALUES ($1, $2, $3) RETURNING *;

-- name: GetFamily :one
SELECT * FROM families WHERE id = $1;

-- name: CreateMember :one
INSERT INTO members (family_id, role, display_name, birth_date) VALUES ($1, $2, $3, $4) RETURNING *;

-- Parents only: caregivers are members too but never parents. Use GetPerson to resolve any acting person.
-- name: ListMembers :many
SELECT * FROM members WHERE family_id = $1 AND role IN ('mother','partner') ORDER BY role;

-- name: GetMember :one
SELECT * FROM members WHERE id = $1 AND family_id = $2 AND role IN ('mother','partner');

-- Any person who can act: a parent or a caregiver whose access was not revoked.
-- name: GetPerson :one
SELECT * FROM members WHERE id = $1 AND family_id = $2 AND revoked_at IS NULL;

-- name: ListCaregivers :many
SELECT * FROM members WHERE family_id = $1 AND role IN ('grandparent','nanny') AND revoked_at IS NULL ORDER BY role, display_name;

-- name: CreateCaregiver :one
INSERT INTO members (family_id, role, display_name, permissions) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: RevokeCaregiver :exec
UPDATE members SET revoked_at = $3 WHERE id = $1 AND family_id = $2 AND role IN ('grandparent','nanny');

-- name: CreateChild :one
INSERT INTO children (family_id, name, birth_date) VALUES ($1, $2, $3) RETURNING *;

-- name: ListChildren :many
SELECT * FROM children WHERE family_id = $1 ORDER BY birth_date;

-- name: CreateCareTeamMember :one
INSERT INTO care_team (family_id, role, name, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListCareTeam :many
SELECT * FROM care_team WHERE family_id = $1 ORDER BY role, name;

-- name: GetFamilyForUpdate :one
SELECT * FROM families WHERE id = $1 FOR UPDATE;

-- name: SkipFamilyDemoClock :one
UPDATE families SET demo_offset_days = demo_offset_days + sqlc.arg(days)::int WHERE id = sqlc.arg(id) RETURNING *;

-- name: UpdateFamilyStage :one
UPDATE families SET stage = $2, due_date = $3 WHERE id = $1 RETURNING *;

-- name: CreateCareTeamMemberFor :one
INSERT INTO care_team (family_id, role, name, clinic, phone, subject_member_id, subject_child_id)
VALUES (@family_id, @role, @name, @clinic, @phone, @subject_member_id, @subject_child_id) RETURNING *;

-- name: DeleteFamily :exec
DELETE FROM families WHERE id = $1;
