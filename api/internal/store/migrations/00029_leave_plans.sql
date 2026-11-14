-- +goose Up

-- One parent's leave wizard answers. They are about work, not health, and both
-- parents see both plans, so there is no visibility. Programs, the timeline and
-- the deadlines are computed on read from these answers and the rules catalog.
CREATE TABLE leave_plans (
    family_id            uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id            uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    state                text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
    employer_employees   integer NOT NULL CHECK (employer_employees BETWEEN 0 AND 1000000),
    months_employed      integer NOT NULL CHECK (months_employed BETWEEN 0 AND 600),
    hours_last_12_months integer NOT NULL CHECK (hours_last_12_months BETWEEN 0 AND 8784),
    starts_on            date,
    weeks_wanted         integer CHECK (weeks_wanted BETWEEN 1 AND 52),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (family_id, member_id)
);

-- +goose Down
DROP TABLE leave_plans;
