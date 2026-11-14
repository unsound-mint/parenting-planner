-- name: CreateInsuranceCall :one
INSERT INTO insurance_calls (family_id, owner_member_id, visibility, called_at, insurer, representative, reference_number, topic, summary, follow_up_on)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- Mirrors access.CanParentRead: own calls, plus calls shared with the partner or the family.
-- name: ListInsuranceCallsVisibleToParent :many
SELECT * FROM insurance_calls
WHERE family_id = @family_id AND called_at >= @since
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY called_at DESC, created_at DESC;
