-- +goose Up

-- One row per change, read by the server-sent-events stream. It carries the kind
-- and the id of what changed, never its content. audience NULL means the whole
-- family; a list means only those members. needs_permission applies to
-- caregivers (parents always pass). Old rows are pruned when new ones are written.
CREATE TABLE live_events (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    kind              text NOT NULL CHECK (kind IN ('family','task','shift','calendar_event','care_log','handoff','appointment_question','invitation')),
    entity_id         text,
    actor_member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    audience          uuid[],
    needs_permission  text CHECK (needs_permission IN ('care_log','baby_passport','schedule','family_plan','pregnancy_updates')),
    at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_events_family_id_idx ON live_events (family_id, id);
CREATE INDEX live_events_at_idx ON live_events (at);

-- +goose Down
DROP TABLE live_events;
