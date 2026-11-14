-- +goose Up
CREATE TABLE appointment_notes (
    family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    appointment_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (author_id, appointment_id)
);

-- +goose Down
DROP TABLE appointment_notes;
