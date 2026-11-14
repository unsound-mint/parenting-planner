-- +goose Up

-- The bell. One row per recipient; the title is a fixed template with names
-- and dates only, never a health value or private text. created_at is always
-- written by the caller on the family's demo clock, so a skipped week does not
-- make new rows look old.
-- on_day is set only for notifications computed on read (plan_item_due), so
-- the unique index allows one per rule and day; event notifications leave it
-- NULL and never collide (NULLs are distinct).
CREATE TABLE notifications (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id            uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    recipient_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind                 text NOT NULL CHECK (kind IN ('task_offered','task_offer_answered','handoff_received','handoff_accepted','plan_item_due','value_flagged','appointment_reminder','invitation_accepted','subscription_started')),
    entity_id            text,
    actor_member_id      uuid REFERENCES members(id) ON DELETE SET NULL,
    title                text NOT NULL,
    on_day               date,
    created_at           timestamptz NOT NULL,
    read_at              timestamptz
);
CREATE INDEX notifications_recipient_created_idx ON notifications (recipient_member_id, created_at DESC);
CREATE UNIQUE INDEX notifications_once_per_day_idx ON notifications (recipient_member_id, kind, entity_id, on_day);

-- +goose Down
DROP TABLE notifications;
