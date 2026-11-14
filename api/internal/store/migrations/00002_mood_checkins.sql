-- +goose Up
CREATE TABLE mood_checkins (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    recorded_at      timestamptz NOT NULL DEFAULT now(),
    mood             smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
    energy           smallint NOT NULL CHECK (energy BETWEEN 1 AND 5),
    sleep_hours      numeric(4,1) NOT NULL CHECK (sleep_hours BETWEEN 0 AND 24),
    note             text
);
CREATE INDEX mood_checkins_family_recorded_idx ON mood_checkins (family_id, recorded_at DESC);

-- +goose Down
DROP TABLE mood_checkins;
