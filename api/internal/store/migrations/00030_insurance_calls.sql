-- +goose Up

-- Calls with the health insurer. A sensitive record (it can describe care and
-- claims): the author owns it and chooses who else may read it.
CREATE TABLE insurance_calls (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility        text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    called_at         timestamptz NOT NULL,
    insurer           text NOT NULL,
    representative    text,
    reference_number  text,
    topic             text NOT NULL CHECK (topic IN ('coverage','claim','prior_authorization','add_baby','billing','other')),
    summary           text NOT NULL,
    follow_up_on      date,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX insurance_calls_family_called_idx ON insurance_calls (family_id, called_at DESC);

-- +goose Down
DROP TABLE insurance_calls;
