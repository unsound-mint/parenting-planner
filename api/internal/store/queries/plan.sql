-- name: UpsertPlanItemProgress :one
INSERT INTO plan_item_progress (family_id, member_id, rule_id, status, updated_at)
VALUES (@family_id, @member_id, @rule_id, @status, @updated_at)
ON CONFLICT (family_id, member_id, rule_id)
DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
RETURNING *;

-- Only the parent's own progress: it is never shared with the other parent.
-- name: ListPlanItemProgress :many
SELECT * FROM plan_item_progress
WHERE family_id = @family_id
  AND member_id = @member_id;
