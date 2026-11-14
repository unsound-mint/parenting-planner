-- +goose Up
-- Mood questionnaires (EPDS, PHQ-9). Not "screenings": clinical screenings
-- (glucose, GBS, vision) are lab_results.
CREATE TABLE mood_screenings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    taken_at         timestamptz NOT NULL,
    instrument       text NOT NULL CHECK (instrument IN ('epds','phq9')),
    answers          smallint[] NOT NULL,
    score            smallint NOT NULL CHECK (score >= 0),
    band             text NOT NULL CHECK (band IN ('green','amber','red')),
    urgent           boolean NOT NULL
);
CREATE INDEX mood_screenings_family_taken_idx ON mood_screenings (family_id, taken_at DESC);

-- +goose Down
DROP TABLE mood_screenings;
