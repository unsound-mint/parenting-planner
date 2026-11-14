-- +goose Up

-- The family's shared baby budget. Both parents read and edit it; caregivers
-- never reach it (the API answers 404). It is plain planning data, not health
-- data, so it has no visibility column. Amounts are whole US cents.
-- A monthly item counts twelve times in the first-year total.
CREATE TABLE budget_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    category      text NOT NULL CHECK (category IN ('pregnancy_care','delivery','equipment','childcare','leave','food','health','other')),
    name          text NOT NULL,
    amount_cents  bigint NOT NULL CHECK (amount_cents >= 0),
    cadence       text NOT NULL CHECK (cadence IN ('once','monthly')),
    payer         text NOT NULL CHECK (payer IN ('mother','partner','shared')),
    created_by    uuid REFERENCES members(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX budget_items_family_idx ON budget_items (family_id, created_at, id);

-- The family's health plan numbers for the birth cost estimate. One row per family.
CREATE TABLE birth_cost_plans (
    family_id              uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    deductible_cents       bigint NOT NULL CHECK (deductible_cents >= 0),
    out_of_pocket_max_cents bigint NOT NULL CHECK (out_of_pocket_max_cents >= 0),
    coinsurance_percent    smallint NOT NULL CHECK (coinsurance_percent BETWEEN 0 AND 100),
    already_paid_cents     bigint NOT NULL DEFAULT 0 CHECK (already_paid_cents >= 0),
    updated_by             uuid REFERENCES members(id) ON DELETE SET NULL,
    updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Daycares, nannies and family arrangements the parents are looking at.
-- application_deadline feeds the calendar while the option is still open.
CREATE TABLE childcare_options (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id            uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name                 text NOT NULL,
    kind                 text NOT NULL CHECK (kind IN ('center','home_based','nanny','family')),
    status               text NOT NULL CHECK (status IN ('inquiring','toured','waitlisted','applied','accepted','declined')),
    monthly_cost_cents   bigint CHECK (monthly_cost_cents >= 0),
    application_deadline date,
    waitlist_position    integer CHECK (waitlist_position >= 1),
    contact              text,
    notes                text,
    created_by           uuid REFERENCES members(id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX childcare_options_family_idx ON childcare_options (family_id, created_at, id);

-- +goose Down
DROP TABLE childcare_options;
DROP TABLE birth_cost_plans;
DROP TABLE budget_items;
