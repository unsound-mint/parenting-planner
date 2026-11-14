-- +goose Up

-- A mission is a catalogue entry (internal/missions); a row here is a family
-- choosing it. Taking a mission creates an ordinary plan task, so it shows in
-- the plan and the load map; done is read from that task, never stored twice.
-- swapped means the family put it back and does not want it suggested again.
-- Missions are practical family tasks, not health records: both parents see all
-- of them and there is no visibility column.
CREATE TABLE mission_picks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    mission_key text NOT NULL,
    status      text NOT NULL CHECK (status IN ('taken','swapped')),
    task_id     uuid REFERENCES tasks(id) ON DELETE CASCADE,
    note        text CHECK (note IS NULL OR char_length(note) <= 140),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (family_id, mission_key),
    CHECK ((status = 'taken') = (task_id IS NOT NULL))
);

-- Stickers a parent has earned. Never awarded for health data (mood, weight,
-- symptoms). seen_at is null until the sticker book has played the peel-and-
-- stick animation for it, so it plays once.
CREATE TABLE stickers (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    key        text NOT NULL,
    earned_at  timestamptz NOT NULL,
    seen_at    timestamptz,
    UNIQUE (member_id, key)
);
CREATE INDEX stickers_family_idx ON stickers (family_id, member_id);

-- +goose Down
DROP TABLE stickers;
DROP TABLE mission_picks;
