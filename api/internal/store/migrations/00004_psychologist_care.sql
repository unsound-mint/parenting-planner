-- +goose Up
-- The demo psychologist is global synthetic data, not family data: every
-- session sees the same row. Invented name.
CREATE TABLE psychologists (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text NOT NULL,
    credentials  text NOT NULL,
    focus        text NOT NULL
);

-- Open session times, seeded per demo family so they never go stale. A slot
-- has no owner: it says nothing about either parent until one books it.
CREATE TABLE psychologist_slots (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    psychologist_id   uuid NOT NULL REFERENCES psychologists(id) ON DELETE CASCADE,
    starts_at         timestamptz NOT NULL,
    duration_minutes  smallint NOT NULL CHECK (duration_minutes BETWEEN 15 AND 180)
);
CREATE INDEX psychologist_slots_family_starts_idx ON psychologist_slots (family_id, starts_at);

-- A booking reveals that a parent sees a psychologist, so it is sensitive and
-- always stored private. Availability is per parent: both may book the same slot.
CREATE TABLE psychologist_bookings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','partner','care_team','family')),
    slot_id          uuid NOT NULL REFERENCES psychologist_slots(id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_member_id, slot_id)
);
CREATE INDEX psychologist_bookings_family_created_idx ON psychologist_bookings (family_id, created_at DESC);

-- The short note a parent writes after a session. Always private to the author.
CREATE TABLE session_notes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','partner','care_team','family')),
    booking_id       uuid NOT NULL UNIQUE REFERENCES psychologist_bookings(id) ON DELETE CASCADE,
    written_at       timestamptz NOT NULL DEFAULT now(),
    text             text NOT NULL CHECK (length(text) BETWEEN 1 AND 1000)
);
CREATE INDEX session_notes_family_written_idx ON session_notes (family_id, written_at DESC);

INSERT INTO psychologists (id, name, credentials, focus) VALUES
('7c0f3b8e-5d2a-4e61-9a43-2b8f6d1c0e57', 'Dr. Maya Ellison (demo)', 'PhD, licensed clinical psychologist', 'Perinatal and postpartum mental health');

-- +goose Down
DROP TABLE session_notes;
DROP TABLE psychologist_bookings;
DROP TABLE psychologist_slots;
DROP TABLE psychologists;
