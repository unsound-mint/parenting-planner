-- +goose Up

-- The weekly postcard: one line the parents share per family and week, and the
-- hearts grandparents send back. Neither table holds health data. period_key
-- is "pregnancy:<week>" or "child:<weeks since birth>", so a new week starts
-- with no line.
CREATE TABLE postcard_lines (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    period_key        text NOT NULL,
    author_member_id  uuid REFERENCES members(id) ON DELETE SET NULL,
    author_name       text NOT NULL,
    body              text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 140),
    updated_at        timestamptz NOT NULL,
    UNIQUE (family_id, period_key)
);

CREATE TABLE postcard_loves (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    from_member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    message          text CHECK (message IS NULL OR char_length(message) BETWEEN 1 AND 140),
    created_at       timestamptz NOT NULL
);
CREATE INDEX postcard_loves_family_created_idx ON postcard_loves (family_id, created_at DESC);

-- love_sent joins the bell. The list keeps labour_started from the birth plan
-- migration.
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('task_offered','task_offer_answered','handoff_received','handoff_accepted','plan_item_due','value_flagged','appointment_reminder','invitation_accepted','subscription_started','labour_started','love_sent'));

-- +goose Down
DELETE FROM notifications WHERE kind = 'love_sent';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('task_offered','task_offer_answered','handoff_received','handoff_accepted','plan_item_due','value_flagged','appointment_reminder','invitation_accepted','subscription_started','labour_started'));
DROP TABLE postcard_loves;
DROP TABLE postcard_lines;
