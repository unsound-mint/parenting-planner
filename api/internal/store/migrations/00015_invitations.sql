-- +goose Up

-- Grandparents and nannies are members too: they get an id to act as. Parent-only
-- queries (GetMember, ListMembers) keep returning parents only, so a caregiver id
-- is a 404 on every parent endpoint.
ALTER TABLE members DROP CONSTRAINT members_role_check;
ALTER TABLE members ADD CONSTRAINT members_role_check CHECK (role IN ('mother','partner','grandparent','nanny'));
ALTER TABLE members DROP CONSTRAINT members_family_id_role_key;
-- A family has one mother and one partner, but any number of caregivers.
CREATE UNIQUE INDEX members_parent_role_key ON members (family_id, role) WHERE role IN ('mother','partner');
-- What a caregiver may see. Parents have everything; their list stays empty.
ALTER TABLE members ADD COLUMN permissions text[] NOT NULL DEFAULT '{}'
    CHECK (permissions <@ ARRAY['care_log','baby_passport','schedule','family_plan','pregnancy_updates']);
-- A revoked caregiver is kept so the access log still names them, but cannot act.
ALTER TABLE members ADD COLUMN revoked_at timestamptz;

-- Only the sha256 of the token is stored.
CREATE TABLE invitations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    invited_by    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    member_id     uuid REFERENCES members(id) ON DELETE SET NULL,
    role          text NOT NULL CHECK (role IN ('grandparent','nanny')),
    display_name  text NOT NULL,
    permissions   text[] NOT NULL CHECK (permissions <@ ARRAY['care_log','baby_passport','schedule','family_plan','pregnancy_updates']),
    token_hash    bytea NOT NULL UNIQUE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    accepted_at   timestamptz,
    revoked_at    timestamptz
);
CREATE INDEX invitations_family_created_idx ON invitations (family_id, created_at DESC);

-- The person a session belongs to. NULL for demo sessions, which act as either
-- parent of their family; an accepted invitation opens a session bound to the
-- caregiver, who may then act only as themselves (access.CanSessionActAs).
ALTER TABLE sessions ADD COLUMN member_id uuid REFERENCES members(id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE sessions DROP COLUMN member_id;
DROP TABLE invitations;
ALTER TABLE members DROP COLUMN revoked_at;
ALTER TABLE members DROP COLUMN permissions;
DROP INDEX members_parent_role_key;
DELETE FROM members WHERE role IN ('grandparent','nanny');
ALTER TABLE members ADD CONSTRAINT members_family_id_role_key UNIQUE (family_id, role);
ALTER TABLE members DROP CONSTRAINT members_role_check;
ALTER TABLE members ADD CONSTRAINT members_role_check CHECK (role IN ('mother','partner'));
