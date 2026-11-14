-- +goose Up

-- What a caregiver may see, chosen by the parents when they invite.
ALTER TABLE caregivers ADD COLUMN permissions text[] NOT NULL DEFAULT '{}'
    CHECK (permissions <@ ARRAY['feeding','sleep','allergies','schedule','visits','milestones']);

-- One invitation per caregiver. Only the sha256 of the token is stored.
CREATE TABLE invitations (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    created_by         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role               text NOT NULL CHECK (role IN ('grandparent','nanny')),
    display_name       text NOT NULL,
    permissions        text[] NOT NULL CHECK (permissions <@ ARRAY['feeding','sleep','allergies','schedule','visits','milestones']),
    token_hash         bytea NOT NULL UNIQUE,
    created_at         timestamptz NOT NULL DEFAULT now(),
    expires_at         timestamptz NOT NULL,
    accepted_at        timestamptz,
    revoked_at         timestamptz
);
CREATE INDEX invitations_family_created_idx ON invitations (family_id, created_at DESC);

-- +goose Down
DROP TABLE invitations;
ALTER TABLE caregivers DROP COLUMN permissions;
