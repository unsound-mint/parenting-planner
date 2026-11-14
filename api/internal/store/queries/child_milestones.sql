-- name: GetMilestoneChild :one
SELECT * FROM children WHERE family_id = $1 AND id = $2;

-- Both parents of the child can read these observations.
-- name: ListChildMilestoneObservations :many
SELECT milestone_id, observed_on FROM child_milestones
WHERE family_id = $1 AND child_id = $2;

-- name: AddChildMilestoneObservation :exec
INSERT INTO child_milestones (family_id, child_id, milestone_id, observed_on, set_by_member_id)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (child_id, milestone_id) DO NOTHING;

-- name: GetChildMilestoneObservation :one
SELECT observed_on FROM child_milestones WHERE family_id = $1 AND child_id = $2 AND milestone_id = $3;

-- name: RemoveChildMilestoneObservation :execrows
DELETE FROM child_milestones WHERE family_id = $1 AND child_id = $2 AND milestone_id = $3;

-- name: LockMilestoneChild :exec
SELECT id FROM children WHERE family_id = $1 AND id = $2 FOR UPDATE;
