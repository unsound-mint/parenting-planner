-- Money pack: every query filters by family_id. Parents only (the handlers
-- answer 404 to anyone else), so nothing here needs a visibility filter.

-- name: ListBudgetItems :many
SELECT * FROM budget_items WHERE family_id = $1 ORDER BY created_at, id;

-- name: CreateBudgetItem :one
INSERT INTO budget_items (family_id, category, name, amount_cents, cadence, payer, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: UpdateBudgetItem :one
UPDATE budget_items SET category = $3, name = $4, amount_cents = $5, cadence = $6, payer = $7
WHERE id = $1 AND family_id = $2 RETURNING *;

-- name: DeleteBudgetItem :execrows
DELETE FROM budget_items WHERE id = $1 AND family_id = $2;

-- name: GetBirthCostPlan :one
SELECT * FROM birth_cost_plans WHERE family_id = $1;

-- name: UpsertBirthCostPlan :one
INSERT INTO birth_cost_plans (family_id, deductible_cents, out_of_pocket_max_cents, coinsurance_percent, already_paid_cents, updated_by, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (family_id) DO UPDATE SET deductible_cents = EXCLUDED.deductible_cents,
    out_of_pocket_max_cents = EXCLUDED.out_of_pocket_max_cents, coinsurance_percent = EXCLUDED.coinsurance_percent,
    already_paid_cents = EXCLUDED.already_paid_cents, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
RETURNING *;

-- name: ListChildcareOptions :many
SELECT * FROM childcare_options WHERE family_id = $1 ORDER BY created_at, id;

-- name: CreateChildcareOption :one
INSERT INTO childcare_options (family_id, name, kind, status, monthly_cost_cents, application_deadline, waitlist_position, contact, notes, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: UpdateChildcareOption :one
UPDATE childcare_options SET name = $3, kind = $4, status = $5, monthly_cost_cents = $6, application_deadline = $7,
    waitlist_position = $8, contact = $9, notes = $10
WHERE id = $1 AND family_id = $2 RETURNING *;

-- name: DeleteChildcareOption :execrows
DELETE FROM childcare_options WHERE id = $1 AND family_id = $2;
