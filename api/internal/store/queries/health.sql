-- name: CreateLabResult :one
INSERT INTO lab_results (family_id, subject_member_id, subject_child_id, owner_member_id, visibility, kind, taken_on, result, note)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- Mirrors access.CanParentRead: own records, plus records shared with the partner or the family.
-- name: ListLabResultsVisibleToParent :many
SELECT * FROM lab_results
WHERE family_id = @family_id
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY taken_on DESC;

-- name: CreateImmunization :one
INSERT INTO immunizations (family_id, subject_member_id, subject_child_id, vaccine, given_on)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListImmunizations :many
SELECT * FROM immunizations WHERE family_id = $1 ORDER BY given_on DESC;
