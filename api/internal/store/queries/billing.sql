-- name: GetSubscription :one
SELECT * FROM subscriptions WHERE family_id = @family_id;

-- Activates the plan from a paid checkout. A no-op when this checkout was
-- already applied (webhook and success screen race) or the family is gone
-- (demo reset), so it returns the number of rows changed.
-- name: ActivateSubscription :execrows
INSERT INTO subscriptions AS s (family_id, tier, status, stripe_customer_id, stripe_subscription_id, checkout_session_id, started_at, updated_at)
SELECT f.id, @tier, 'active', @stripe_customer_id, @stripe_subscription_id, @checkout_session_id, @now::timestamptz, @now::timestamptz
FROM families f WHERE f.id = @family_id
ON CONFLICT (family_id) DO UPDATE SET
    tier = EXCLUDED.tier, status = 'active',
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    checkout_session_id = EXCLUDED.checkout_session_id,
    started_at = EXCLUDED.started_at, current_period_end = NULL,
    updated_at = EXCLUDED.updated_at
WHERE s.checkout_session_id <> EXCLUDED.checkout_session_id;

-- name: CancelSubscription :execrows
UPDATE subscriptions SET status = 'canceled', updated_at = @now
WHERE family_id = @family_id AND stripe_subscription_id = @stripe_subscription_id AND status <> 'canceled';

-- name: RecordStripeEvent :execrows
INSERT INTO stripe_events (id, type, received_at) VALUES (@id, @type, @received_at)
ON CONFLICT (id) DO NOTHING;
