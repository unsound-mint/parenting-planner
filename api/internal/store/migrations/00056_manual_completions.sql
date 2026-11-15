-- +goose Up
-- One row per person and Practice manual they finished (manual ids live in
-- internal/content/manuals.json). Like simulator rounds, only the person sees it.
CREATE TABLE manual_completions (
    family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    manual_id    text NOT NULL CHECK (length(manual_id) BETWEEN 1 AND 64),
    completed_at timestamptz NOT NULL,
    PRIMARY KEY (family_id, member_id, manual_id)
);

-- +goose Down
DROP TABLE manual_completions;
