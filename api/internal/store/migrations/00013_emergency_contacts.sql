-- +goose Up

-- People to call about the baby, shown on the baby passport card. Not a
-- per-person health record: anyone allowed the passport sees them.
CREATE TABLE emergency_contacts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq         bigint GENERATED ALWAYS AS IDENTITY,
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name        text NOT NULL,
    relation    text NOT NULL,
    phone       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX emergency_contacts_family_idx ON emergency_contacts (family_id, seq);

-- +goose Down
DROP TABLE emergency_contacts;
