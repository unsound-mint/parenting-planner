-- name: CreateLabResult :one
INSERT INTO lab_results (family_id, subject_member_id, subject_child_id, owner_member_id, visibility, kind, taken_on, result, note)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- Mirrors access.CanParentReadHealthRecord: records about the child, own
-- records, plus records shared with the partner or the family.
-- name: ListLabResultsVisibleToParent :many
SELECT * FROM lab_results
WHERE family_id = @family_id
  AND (subject_child_id IS NOT NULL OR owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY taken_on DESC;

-- name: CreateImmunization :one
INSERT INTO immunizations (family_id, subject_member_id, subject_child_id, vaccine, given_on)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListImmunizations :many
SELECT * FROM immunizations WHERE family_id = $1 ORDER BY given_on DESC;

-- Health passport (GET /members/{memberId}/passport).

-- name: CreateLabValue :one
INSERT INTO lab_results (family_id, subject_member_id, subject_child_id, owner_member_id, visibility, kind, taken_on, name, value, unit, ref_low, ref_high)
VALUES (@family_id, @subject_member_id, @subject_child_id, @owner_member_id, @visibility, @kind, @taken_on, @name, @value, @unit, @ref_low, @ref_high)
RETURNING *;

-- Mirrors access.CanParentReadHealthRecord: records about the child, own records,
-- plus records shared with the partner or the family. Panels without a single
-- value are left out.
-- name: ListPassportLabsVisibleToParent :many
SELECT * FROM lab_results
WHERE family_id = @family_id
  AND value IS NOT NULL
  AND (subject_child_id IS NOT NULL OR owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY taken_on DESC, created_at DESC;

-- name: CreateAllergy :one
INSERT INTO allergies (family_id, subject_member_id, subject_child_id, owner_member_id, visibility, substance, certainty, reaction, noted_on)
VALUES (@family_id, @subject_member_id, @subject_child_id, @owner_member_id, @visibility, @substance, @certainty, @reaction, @noted_on)
RETURNING *;

-- Mirrors access.CanParentReadHealthRecord: records about the child, own records,
-- plus records shared with the partner or the family.
-- name: ListAllergiesVisibleToParent :many
SELECT * FROM allergies
WHERE family_id = @family_id
  AND (subject_child_id IS NOT NULL OR owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY created_at DESC;

-- name: CreateGivenDose :one
INSERT INTO immunizations (family_id, subject_member_id, subject_child_id, vaccine, dose, given_on)
VALUES (@family_id, @subject_member_id, @subject_child_id, @vaccine, @dose, @given_on) RETURNING *;

-- name: CreateScheduledDose :one
INSERT INTO vaccine_schedule (family_id, subject_member_id, subject_child_id, vaccine, dose, due_on)
VALUES (@family_id, @subject_member_id, @subject_child_id, @vaccine, @dose, @due_on) RETURNING *;

-- name: ListScheduledDoses :many
SELECT * FROM vaccine_schedule WHERE family_id = $1 ORDER BY due_on;

-- name: CreateGrowthMeasurement :one
INSERT INTO growth_measurements (family_id, child_id, measured_on, weight_kg, height_cm)
VALUES (@family_id, @child_id, @measured_on, @weight_kg, @height_cm) RETURNING *;

-- name: ListGrowthMeasurements :many
SELECT * FROM growth_measurements WHERE family_id = $1 ORDER BY measured_on;

-- Mirrors access.CanParentReadHealthRecord and access.CanCaregiverReadChildRecord:
-- records about the child are readable by both parents and by caregivers with
-- baby_passport (the handler checks the permission), whatever their owner chose;
-- only the parent's own records use visibility.
-- name: ListChildAllergiesVisibleToParent :many
SELECT * FROM allergies WHERE family_id = @family_id AND subject_child_id = @child_id
ORDER BY created_at DESC;

-- Logging health records (POST /members/{memberId}/immunizations, ...).

-- name: ChildInFamily :one
SELECT EXISTS (SELECT 1 FROM children WHERE id = @child_id AND family_id = @family_id);

-- The earliest scheduled dose of a vaccine for one subject that no given dose
-- has matched yet (same subject, vaccine and dose label, as the passport matches).
-- name: NextScheduledDose :one
SELECT vs.dose FROM vaccine_schedule vs
WHERE vs.family_id = @family_id
  AND vs.vaccine = @vaccine
  AND vs.subject_member_id IS NOT DISTINCT FROM sqlc.narg(subject_member_id)::uuid
  AND vs.subject_child_id IS NOT DISTINCT FROM sqlc.narg(subject_child_id)::uuid
  AND NOT EXISTS (
    SELECT 1 FROM immunizations i
    WHERE i.family_id = vs.family_id AND i.vaccine = vs.vaccine AND i.dose = vs.dose
      AND i.subject_member_id IS NOT DISTINCT FROM vs.subject_member_id
      AND i.subject_child_id IS NOT DISTINCT FROM vs.subject_child_id)
ORDER BY vs.due_on
LIMIT 1;
