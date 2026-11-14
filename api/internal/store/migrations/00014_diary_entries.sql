-- +goose Up

-- A parent's private diary. The text is encrypted before it is stored (AES-GCM,
-- key in the server environment); the author decides per entry who may read it.
-- agenda_topic is a short topic the author chose for their psychologist agenda,
-- never the entry text, and never visible to anyone else.
CREATE TABLE diary_entries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    written_at       timestamptz NOT NULL,
    body_sealed      bytea NOT NULL,
    agenda_topic     text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX diary_entries_family_written_idx ON diary_entries (family_id, written_at DESC);

-- +goose Down
DROP TABLE diary_entries;
