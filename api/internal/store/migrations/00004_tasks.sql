-- +goose Up
-- Family to-dos. Every task has one assignee; handing it to the other parent
-- only proposes it (pending_assignee_member_id) until they accept.
-- Tasks are family-wide, not one parent's private data, so there is no visibility.
CREATE TABLE tasks (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id                   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    title                       text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    due_on                      date,
    assignee_member_id          uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    pending_assignee_member_id  uuid REFERENCES members(id) ON DELETE SET NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    CHECK (pending_assignee_member_id IS DISTINCT FROM assignee_member_id)
);
CREATE INDEX tasks_family_due_idx ON tasks (family_id, due_on);

-- +goose Down
DROP TABLE tasks;
