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

-- A stage or due date change by the parents ends pregnancy loss support without restoring anything.
-- name: UpdateFamilyStage :one
UPDATE families SET stage = $2, due_date = $3,
    pregnancy_loss_recorded_at = NULL, pregnancy_loss_occurred_on = NULL,
    pregnancy_loss_prior_stage = NULL, pregnancy_loss_prior_due_date = NULL
WHERE id = $1 RETURNING *;

-- Turns support on: stage planning, no due date, the replaced values kept for an undo.
-- name: RecordPregnancyLoss :one
UPDATE families SET stage = 'planning', due_date = NULL,
    pregnancy_loss_recorded_at = @recorded_at, pregnancy_loss_occurred_on = @occurred_on,
    pregnancy_loss_prior_stage = stage, pregnancy_loss_prior_due_date = due_date
WHERE id = @id AND stage = 'pregnancy' RETURNING *;

-- Turning support on drops what the family has not read yet about the pregnancy
-- and the baby: plan_item_due for the given rules, and handoffs.
-- name: DeleteUnreadPregnancyNotifications :execrows
DELETE FROM notifications
WHERE family_id = @family_id AND read_at IS NULL
  AND (kind IN ('handoff_received', 'handoff_accepted')
       OR (kind = 'plan_item_due' AND entity_id = ANY (@rule_ids::text[])));

-- name: FamilyInPregnancyLoss :one
SELECT (pregnancy_loss_recorded_at IS NOT NULL)::bool FROM families WHERE id = $1;

-- Turns support off and restores what it replaced.
-- name: RestorePregnancyLoss :one
UPDATE families SET stage = pregnancy_loss_prior_stage, due_date = pregnancy_loss_prior_due_date,
    pregnancy_loss_recorded_at = NULL, pregnancy_loss_occurred_on = NULL,
    pregnancy_loss_prior_stage = NULL, pregnancy_loss_prior_due_date = NULL
WHERE id = @id AND pregnancy_loss_recorded_at IS NOT NULL RETURNING *;

-- name: CreateCareTeamMemberFor :one
INSERT INTO care_team (family_id, role, name, clinic, phone, subject_member_id, subject_child_id)
VALUES (@family_id, @role, @name, @clinic, @phone, @subject_member_id, @subject_child_id) RETURNING *;

-- name: DeleteFamily :exec
DELETE FROM families WHERE id = $1;

-- Care team rows are family data without a visibility. A row without a subject
-- is shared by role (the family pediatrician), so any parent may change it;
-- a psychologist is only ever the acting parent's own.
-- name: UpdateCareTeamMember :one
UPDATE care_team
SET name = @name, role = @role, clinic = @clinic, phone = @phone
WHERE id = @id AND family_id = @family_id
  AND (@role::text <> 'psychologist' OR subject_member_id IS NOT NULL OR subject_child_id IS NOT NULL)
  AND (subject_member_id = @actor_id OR subject_child_id IS NOT NULL
       OR (subject_member_id IS NULL AND subject_child_id IS NULL AND role <> 'psychologist'))
RETURNING *;

-- name: DeleteCareTeamMember :execrows
DELETE FROM care_team
WHERE id = @id AND family_id = @family_id
  AND (subject_member_id = @actor_id OR subject_child_id IS NOT NULL
       OR (subject_member_id IS NULL AND subject_child_id IS NULL AND role <> 'psychologist'));

-- name: UpdateCaregiverPermissions :one
UPDATE members SET permissions = $3
WHERE id = $2 AND family_id = $1 AND role IN ('grandparent','nanny') AND revoked_at IS NULL
RETURNING *;
