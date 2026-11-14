-- +goose Up

-- Childcare the family is looking at: daycares, nannies, family care. Family-
-- wide and not sensitive: both parents see and edit the same rows, so there is
-- no owner or visibility. An offered option with decide_by feeds the plan.
CREATE TABLE childcare_options (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name              text NOT NULL,
    kind              text NOT NULL CHECK (kind IN ('daycare','nanny','family')),
    contact           text,
    monthly_cost      integer CHECK (monthly_cost >= 0),
    status            text NOT NULL CHECK (status IN ('researching','toured','applied','waitlisted','offered','accepted','declined')),
    waitlist_position integer CHECK (waitlist_position >= 1),
    applied_on        date,
    decide_by         date,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX childcare_options_family_created_idx ON childcare_options (family_id, created_at DESC);

-- +goose Down
DROP TABLE childcare_options;
