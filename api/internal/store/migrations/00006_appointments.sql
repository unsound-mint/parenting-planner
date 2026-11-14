-- +goose Up
CREATE TABLE appointments (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    with_name  text NOT NULL,
    starts_at  timestamptz NOT NULL
);
CREATE INDEX appointments_family_starts_idx ON appointments (family_id, starts_at);

CREATE TABLE appointment_questions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    body            text NOT NULL,
    answered        boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointment_questions_family_idx ON appointment_questions (family_id, created_at);

-- +goose Down
DROP TABLE appointment_questions, appointments;
