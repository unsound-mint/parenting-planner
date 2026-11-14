-- +goose Up
-- Virtual Baby practice: sessions belong to the family (both parents see them),
-- each handled moment records which parent answered. Practice only, no health
-- data, so there is no owner or visibility column.
CREATE TABLE virtual_baby_sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    mode         text NOT NULL CHECK (mode IN ('evening','challenge')),
    started_by   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    started_at   timestamptz NOT NULL,
    finished_at  timestamptz
);
CREATE INDEX virtual_baby_sessions_family_started_idx ON virtual_baby_sessions (family_id, started_at DESC);
-- One active session per family.
CREATE UNIQUE INDEX virtual_baby_sessions_one_active_idx ON virtual_baby_sessions (family_id) WHERE finished_at IS NULL;

CREATE TABLE virtual_baby_moments (
    session_id   uuid NOT NULL REFERENCES virtual_baby_sessions(id) ON DELETE CASCADE,
    family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    seq          integer NOT NULL CHECK (seq >= 0),
    scenario_id  text NOT NULL,
    choice_id    text NOT NULL,
    handled_by   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    handled_at   timestamptz NOT NULL,
    -- The primary key makes a second answer to the same moment a no-op.
    PRIMARY KEY (session_id, seq)
);

-- +goose Down
DROP TABLE virtual_baby_moments;
DROP TABLE virtual_baby_sessions;
