-- +goose Up
-- One row per family: a second upgrade request replaces the first. No payments.
CREATE TABLE upgrade_intents (
    family_id     uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    tier          text NOT NULL CHECK (tier IN ('plus','concierge')),
    requested_at  timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE upgrade_intents;
