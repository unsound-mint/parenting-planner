-- +goose Up

-- One model for every owned checklist item: kind task is the shared plan,
-- paperwork the seeded US paperwork checklist, hospital_bag an item on one of
-- the three bag lists. Both parents see all of them, so there is no visibility.
-- A deadline is either a plain date (due_on) or computed on read from the due
-- date or the birth date (due_anchor + due_offset_days), so moving the due date
-- moves it.
CREATE TABLE tasks (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq                         bigint GENERATED ALWAYS AS IDENTITY,
    family_id                   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    kind                        text NOT NULL CHECK (kind IN ('task','paperwork','hospital_bag')),
    title                       text NOT NULL,
    detail                      text,
    due_on                      date,
    due_anchor                  text CHECK (due_anchor IN ('due_date','birth_date')),
    due_offset_days             integer,
    bag                         text CHECK (bag IN ('mother','partner','baby')),
    assignee_member_id          uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    pending_assignee_member_id  uuid REFERENCES members(id) ON DELETE SET NULL,
    done                        boolean NOT NULL DEFAULT false,
    done_at                     timestamptz,
    done_by_member_id           uuid REFERENCES members(id) ON DELETE SET NULL,
    source_title                text,
    source_url                  text,
    source_checked_on           date,
    created_by_member_id        uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    CHECK ((due_anchor IS NULL) = (due_offset_days IS NULL)),
    CHECK ((kind = 'hospital_bag') = (bag IS NOT NULL)),
    CHECK (due_on IS NULL OR due_anchor IS NULL),
    CHECK (done = (done_at IS NOT NULL))
);
CREATE INDEX tasks_family_kind_idx ON tasks (family_id, kind, seq);

-- +goose Down
DROP TABLE tasks;
