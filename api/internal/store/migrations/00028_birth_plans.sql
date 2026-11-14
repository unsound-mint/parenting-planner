-- +goose Up

-- Where to go and what to bring when labour starts. One row per family: the
-- birth hospital with its desk phone, the usual drive time from home and a note
-- of the family's preferences to talk through with the care team. Hospital
-- details are not health data.
CREATE TABLE birth_plans (
    family_id         uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    hospital_name     text NOT NULL,
    hospital_address  text NOT NULL,
    hospital_phone    text,
    desk_phone        text,
    travel_minutes    integer CHECK (travel_minutes >= 0),
    preferences_note  text
);

-- The other parent's phone, for the "who to call" list. Optional.
ALTER TABLE members ADD COLUMN phone text;

-- The labour alert is a notification of its own kind.
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'task_offered','task_offer_answered','handoff_received','handoff_accepted','plan_item_due','value_flagged',
    'appointment_reminder','invitation_accepted','subscription_started','labour_started'));

ALTER TABLE live_events DROP CONSTRAINT live_events_kind_check;
ALTER TABLE live_events ADD CONSTRAINT live_events_kind_check CHECK (kind IN (
    'family','task','shift','calendar_event','care_log','handoff','appointment_question','invitation','notification'));

-- +goose Down
DELETE FROM live_events WHERE kind = 'notification';
ALTER TABLE live_events DROP CONSTRAINT live_events_kind_check;
ALTER TABLE live_events ADD CONSTRAINT live_events_kind_check CHECK (kind IN (
    'family','task','shift','calendar_event','care_log','handoff','appointment_question','invitation'));

DELETE FROM notifications WHERE kind = 'labour_started';
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'task_offered','task_offer_answered','handoff_received','handoff_accepted','plan_item_due','value_flagged',
    'appointment_reminder','invitation_accepted','subscription_started'));
ALTER TABLE members DROP COLUMN phone;
DROP TABLE birth_plans;
