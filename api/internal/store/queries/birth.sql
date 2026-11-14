-- name: UpsertBirthPlan :one
INSERT INTO birth_plans (family_id, hospital_name, hospital_address, hospital_phone, desk_phone, travel_minutes, preferences_note)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (family_id) DO UPDATE SET hospital_name = EXCLUDED.hospital_name, hospital_address = EXCLUDED.hospital_address,
    hospital_phone = EXCLUDED.hospital_phone, desk_phone = EXCLUDED.desk_phone, travel_minutes = EXCLUDED.travel_minutes,
    preferences_note = EXCLUDED.preferences_note
RETURNING *;

-- name: GetBirthPlan :one
SELECT * FROM birth_plans WHERE family_id = $1;

-- name: SetMemberPhone :exec
UPDATE members SET phone = $2 WHERE id = $1 AND family_id = $3;

-- Serialises labour alerts of one family so two taps cannot both send.
-- name: LockLabourAlerts :exec
SELECT pg_advisory_xact_lock(hashtextextended('labour:' || @family_id::text, 0));

-- name: LabourAlertSince :one
SELECT EXISTS (
    SELECT 1 FROM notifications WHERE family_id = @family_id AND kind = 'labour_started' AND created_at >= @since
);
