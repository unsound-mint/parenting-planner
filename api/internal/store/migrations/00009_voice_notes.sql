-- +goose Up
-- Short recordings for shift handoffs (#291). handoff_id has no foreign key
-- yet: the handoffs table arrives with the care log (#370), which adds it.
CREATE TABLE voice_notes (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    uploader_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    handoff_id         uuid,
    content_type       text NOT NULL CHECK (content_type ~ '^audio/(webm|mp4|ogg)($|;)'),
    size_bytes         integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 1048576),
    duration_seconds   integer CHECK (duration_seconds BETWEEN 1 AND 120),
    audio              bytea NOT NULL,
    created_at         timestamptz NOT NULL
);
-- The audio is already compressed; skip Postgres's own compression.
ALTER TABLE voice_notes ALTER COLUMN audio SET STORAGE EXTERNAL;
CREATE INDEX voice_notes_family_created_idx ON voice_notes (family_id, created_at DESC);

-- +goose Down
DROP TABLE voice_notes;
