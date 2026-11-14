-- +goose Up

-- How a parent arranged their psychologist agenda: the saved order and the topics
-- they removed. Topics are derived from the parent's own data with stable ids, so a
-- removal is stored here instead of deleting anything. Private to the author, like
-- session notes: every query filters by the member.
CREATE TABLE agenda_topic_prefs (
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    topic_id    uuid NOT NULL,
    position    integer,
    removed_at  timestamptz,
    PRIMARY KEY (member_id, topic_id)
);

-- +goose Down
DROP TABLE agenda_topic_prefs;
