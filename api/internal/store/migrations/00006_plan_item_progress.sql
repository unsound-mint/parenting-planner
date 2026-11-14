-- +goose Up
-- Progress one parent recorded on a plan item. Plan items are computed by the
-- rules engine, so the row is keyed by the rule id. Only its own parent reads
-- it, for their own plan, so it has member_id and no visibility.
CREATE TABLE plan_item_progress (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    rule_id     text NOT NULL,
    status      text NOT NULL CHECK (status IN ('booked','done')),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (family_id, member_id, rule_id)
);

-- +goose Down
DROP TABLE plan_item_progress;
