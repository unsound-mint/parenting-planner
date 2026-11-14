-- +goose Up
CREATE TABLE diary_entries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    written_at       timestamptz NOT NULL DEFAULT now(),
    body             text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000)
);
CREATE INDEX diary_entries_family_written_idx ON diary_entries (family_id, written_at DESC);

-- +goose Down
DROP TABLE diary_entries;
