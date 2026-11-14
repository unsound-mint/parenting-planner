-- name: CreateEmergencyContact :one
INSERT INTO emergency_contacts (family_id, name, relation, phone) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: ListEmergencyContacts :many
SELECT * FROM emergency_contacts WHERE family_id = $1 ORDER BY created_at, id;
