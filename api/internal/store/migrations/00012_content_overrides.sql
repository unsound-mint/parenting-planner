-- +goose Up

-- One demo family's edits to the content catalog in code (weekly cards,
-- guides, practice questions, checklist items), made in the admin panel.
-- Only title and body; the source stays the catalog's. A null field keeps
-- the catalog's text.
CREATE TABLE content_overrides (
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('pregnancy_week','guide','simulator_question','checklist_item')),
    item_id     text NOT NULL,
    title       text,
    body        text,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (family_id, kind, item_id)
);

-- +goose Down
DROP TABLE content_overrides;
