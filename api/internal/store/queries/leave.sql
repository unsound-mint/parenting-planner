-- name: UpsertLeavePlan :one
INSERT INTO leave_plans (family_id, member_id, state, employer_employees, months_employed, hours_last_12_months, starts_on, weeks_wanted)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (family_id, member_id) DO UPDATE SET
    state = EXCLUDED.state, employer_employees = EXCLUDED.employer_employees, months_employed = EXCLUDED.months_employed,
    hours_last_12_months = EXCLUDED.hours_last_12_months, starts_on = EXCLUDED.starts_on, weeks_wanted = EXCLUDED.weeks_wanted,
    updated_at = now()
RETURNING *;

-- name: ListLeavePlans :many
SELECT * FROM leave_plans WHERE family_id = $1;
