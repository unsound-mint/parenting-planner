-- +goose Up

-- One family per demo session copy. Real accounts will attach users to families later.
CREATE TABLE families (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template    text NOT NULL,
    stage       text NOT NULL CHECK (stage IN ('planning','trying','pregnancy','postpartum','infant','toddler','preschool','school_age')),
    due_date    date,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE members (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    role          text NOT NULL CHECK (role IN ('mother','partner')),
    display_name  text NOT NULL,
    birth_date    date,
    UNIQUE (family_id, role)
);

CREATE TABLE children (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name        text NOT NULL,
    birth_date  date NOT NULL
);
CREATE INDEX children_family_idx ON children (family_id);

-- Only the sha256 of the cookie token is stored.
CREATE TABLE sessions (
    token_hash  bytea PRIMARY KEY,
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_family_idx ON sessions (family_id);

CREATE TABLE care_team (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    role        text NOT NULL CHECK (role IN ('obgyn','midwife','birth_clinic','pediatrician','primary_care','psychologist','doula','lactation')),
    name        text NOT NULL,
    phone       text,
    address     text
);
CREATE INDEX care_team_family_idx ON care_team (family_id);

-- Sensitive records carry an owner and a visibility. The read policy lives in
-- internal/access; queries that list them must filter with the same rules.
--   private:   owner only
--   partner:   owner and the other parent
--   care_team: owner and their chosen professionals (not the partner)
--   family:    both parents
CREATE TABLE lab_results (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    subject_member_id  uuid REFERENCES members(id) ON DELETE CASCADE,
    subject_child_id   uuid REFERENCES children(id) ON DELETE CASCADE,
    owner_member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility         text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    kind               text NOT NULL,
    taken_on           date NOT NULL,
    result             jsonb NOT NULL DEFAULT '{}',
    note               text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    CHECK ((subject_member_id IS NULL) <> (subject_child_id IS NULL))
);
CREATE INDEX lab_results_family_kind_idx ON lab_results (family_id, kind);

CREATE TABLE immunizations (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    subject_member_id  uuid REFERENCES members(id) ON DELETE CASCADE,
    subject_child_id   uuid REFERENCES children(id) ON DELETE CASCADE,
    vaccine            text NOT NULL,
    given_on           date NOT NULL,
    CHECK ((subject_member_id IS NULL) <> (subject_child_id IS NULL))
);
CREATE INDEX immunizations_family_idx ON immunizations (family_id);

-- Who read or changed sensitive data. Written by internal/access.
CREATE TABLE audit_log (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    actor_member_id  uuid REFERENCES members(id) ON DELETE SET NULL,
    action           text NOT NULL,
    entity           text NOT NULL,
    entity_id        text,
    at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_family_at_idx ON audit_log (family_id, at);

-- +goose Down
DROP TABLE audit_log, immunizations, lab_results, care_team, sessions, children, members, families;
