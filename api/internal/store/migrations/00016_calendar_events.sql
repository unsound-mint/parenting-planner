-- +goose Up

-- Events a parent adds: appointments, classes, reminders. Shifts, task due dates
-- and psychologist sessions are not stored here; the calendar feed merges them.
-- visibility private = owner only, family = both parents and the attendees.
CREATE TABLE calendar_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','family')),
    kind             text NOT NULL CHECK (kind IN ('appointment','class','reminder','other')),
    title            text NOT NULL,
    starts_at        timestamptz NOT NULL,
    ends_at          timestamptz,
    all_day          boolean NOT NULL DEFAULT false,
    location         text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX calendar_events_family_starts_idx ON calendar_events (family_id, starts_at);

CREATE TABLE calendar_event_attendees (
    event_id   uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, member_id)
);
CREATE INDEX calendar_event_attendees_member_idx ON calendar_event_attendees (member_id);

-- +goose Down
DROP TABLE calendar_event_attendees, calendar_events;
