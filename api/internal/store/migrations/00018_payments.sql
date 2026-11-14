-- +goose Up
-- One paid plan per family (it unlocks both parents). Family.tier is derived
-- from this row: a family with no row, or a canceled one, is on free.
CREATE TABLE subscriptions (
    family_id               uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    tier                    text NOT NULL CHECK (tier IN ('plus','concierge')),
    status                  text NOT NULL CHECK (status IN ('active','past_due','canceled')),
    stripe_customer_id      text,
    stripe_subscription_id  text,
    -- The checkout that set this row. Applying the same checkout again (the
    -- webhook and the success screen both do) changes nothing.
    checkout_session_id     text NOT NULL,
    started_at              timestamptz NOT NULL,
    current_period_end      timestamptz,
    updated_at              timestamptz NOT NULL
);

-- Stripe event ids already handled, so a redelivered webhook is a no-op.
-- Stripe ids are global, so this table has no family_id.
CREATE TABLE stripe_events (
    id           text PRIMARY KEY,
    type         text NOT NULL,
    received_at  timestamptz NOT NULL
);

-- +goose Down
DROP TABLE stripe_events;
DROP TABLE subscriptions;
