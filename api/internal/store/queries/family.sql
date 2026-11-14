-- name: CreateFamily :one
INSERT INTO families (template, stage, due_date) VALUES ($1, $2, $3) RETURNING *;

-- name: GetFamily :one
SELECT * FROM families WHERE id = $1;

-- name: CreateMember :one
INSERT INTO members (family_id, role, display_name, birth_date) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: ListMembers :many
SELECT * FROM members WHERE family_id = $1 ORDER BY role;

-- name: GetMember :one
SELECT * FROM members WHERE id = $1 AND family_id = $2;

-- name: CreateChild :one
INSERT INTO children (family_id, name, birth_date) VALUES ($1, $2, $3) RETURNING *;

-- name: ListChildren :many
SELECT * FROM children WHERE family_id = $1 ORDER BY birth_date;

-- name: CreateCareTeamMember :one
INSERT INTO care_team (family_id, role, name, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListCareTeam :many
SELECT * FROM care_team WHERE family_id = $1 ORDER BY role, name;

-- name: CreateCaregiver :one
INSERT INTO caregivers (family_id, role, display_name) VALUES ($1, $2, $3) RETURNING *;

-- name: ListCaregivers :many
SELECT * FROM caregivers WHERE family_id = $1 ORDER BY role;
