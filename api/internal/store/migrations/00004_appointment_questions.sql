-- +goose Up

-- Stored calendar events. Only the columns the appointment questions need
-- exist so far; the calendar feature (#229) adds attendees and the rest in
-- its own migration. visibility private is owner only, family is both parents
-- (access.CanParentRead with Private and Family).
CREATE TABLE calendar_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','family')),
    kind             text NOT NULL CHECK (kind IN ('appointment','class','reminder','other')),
    title            text NOT NULL,
    starts_at        timestamptz NOT NULL,
    ends_at          timestamptz,
    all_day          boolean NOT NULL DEFAULT false,
    location         text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_events_family_starts_idx ON calendar_events (family_id, starts_at);

-- Which appointment a question was first added to. Carry-over to a later
-- appointment is computed on read, never stored.
CREATE TABLE appointment_questions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    appointment_id   uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    text             text NOT NULL,
    answered_at      timestamptz,
    answer           text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointment_questions_family_created_idx ON appointment_questions (family_id, created_at DESC);

-- +goose Down
DROP TABLE appointment_questions;
DROP TABLE calendar_events;
