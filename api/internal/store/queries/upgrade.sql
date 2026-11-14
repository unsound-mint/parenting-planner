-- name: UpsertUpgradeIntent :one
INSERT INTO upgrade_intents (family_id, tier, requested_at)
VALUES (@family_id, @tier, @requested_at)
ON CONFLICT (family_id) DO UPDATE SET tier = EXCLUDED.tier, requested_at = EXCLUDED.requested_at
RETURNING *;

-- name: GetUpgradeIntent :one
SELECT * FROM upgrade_intents WHERE family_id = @family_id;
