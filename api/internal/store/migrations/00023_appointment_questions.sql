-- +goose Up

-- Questions a parent wants to ask at an appointment. Health data: the author owns
-- it and chooses who else may read it (private, partner, care_team, family).
-- asked_for_event_id is the appointment it was first added to; where it is shown now
-- (carried over to the next visit) is computed on read.
CREATE TABLE appointment_questions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq                 bigint GENERATED ALWAYS AS IDENTITY,
    family_id           uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility          text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    asked_for_event_id  uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    body                text NOT NULL,
    answered            boolean NOT NULL DEFAULT false,
    answer              text,
    answered_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (answered = (answered_at IS NOT NULL))
);
CREATE INDEX appointment_questions_family_idx ON appointment_questions (family_id, seq);

-- +goose Down
DROP TABLE appointment_questions;
