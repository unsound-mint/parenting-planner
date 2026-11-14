-- +goose Up

-- People who help with the baby but are not parents: a grandparent or a nanny.
-- They are a separate table so every parent-only query on members stays parent-only.
-- A caregiver has no rows in sensitive tables (mood, diary, labs, session notes).
CREATE TABLE caregivers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    role          text NOT NULL CHECK (role IN ('grandparent','nanny')),
    display_name  text NOT NULL,
    UNIQUE (family_id, role)
);

-- +goose Down
DROP TABLE caregivers;
