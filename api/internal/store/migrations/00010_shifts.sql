-- +goose Up

-- Recurring care shifts a person commits to. agreed = committed before "Baby is
-- home" (no calendar occurrences yet); active = in the calendar from starts_on.
-- Times are HH:MM wall-clock times; an end at or before the start means the next morning.
-- round_id has no foreign key yet: simulator rounds are a separate module.
CREATE TABLE shifts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    title       text NOT NULL,
    days        text[] NOT NULL CHECK (cardinality(days) >= 1 AND days <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']),
    start_time  text NOT NULL CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    end_time    text NOT NULL CHECK (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    status      text NOT NULL CHECK (status IN ('agreed','active')),
    starts_on   date,
    round_id    uuid,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (start_time <> end_time),
    CHECK ((status = 'active') = (starts_on IS NOT NULL))
);
CREATE INDEX shifts_family_idx ON shifts (family_id, created_at);
CREATE INDEX shifts_member_idx ON shifts (member_id);

-- +goose Down
DROP TABLE shifts;
