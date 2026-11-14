-- +goose Up

-- Partner nudges a parent closed. A nudge is derived from the other parent's
-- activity and has no row of its own, so its stable key is stored instead.
CREATE TABLE nudge_dismissals (
    family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    nudge_key     text NOT NULL CHECK (length(nudge_key) BETWEEN 1 AND 200),
    dismissed_at  timestamptz NOT NULL,
    PRIMARY KEY (member_id, nudge_key)
);

-- The brief a parent sends their psychologist before a session. It belongs to
-- the parent (a cancelled booking leaves the draft in place), is always
-- private, and only leaves the app when the parent schedules or sends it.
-- note_sealed and snapshot_sealed are encrypted like diary_entries.body_sealed:
-- the snapshot can hold journal text the parent chose to send.
CREATE TABLE session_briefs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','partner','care_team','family')),
    booking_id       uuid REFERENCES psychologist_bookings(id) ON DELETE SET NULL,
    include_mood     boolean NOT NULL DEFAULT false,
    entry_ids        uuid[] NOT NULL DEFAULT '{}',
    note_sealed      bytea,
    status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent')),
    send_at          timestamptz,
    sent_at          timestamptz,
    snapshot_sealed  bytea,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NOT NULL
);
CREATE INDEX session_briefs_family_updated_idx ON session_briefs (family_id, updated_at DESC);

-- +goose Down
DROP TABLE session_briefs;
DROP TABLE nudge_dismissals;
