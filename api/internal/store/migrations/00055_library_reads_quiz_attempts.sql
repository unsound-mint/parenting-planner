-- +goose Up
-- Library reading state, one row per parent and topic: read_at when they
-- opened it, saved_at while it is saved for later. Reading history, not a
-- sensitive record: family-scoped and only ever read for the same member.
CREATE TABLE library_reads (
    family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    topic_id   text NOT NULL CHECK (length(topic_id) BETWEEN 1 AND 100),
    read_at    timestamptz,
    saved_at   timestamptz,
    PRIMARY KEY (member_id, topic_id)
);
CREATE INDEX library_reads_family_member_idx ON library_reads (family_id, member_id);

-- A retake of one quiz deck (a learning path): the score, and the questions
-- missed so "review the ones you missed" follows the latest attempt.
CREATE TABLE quiz_attempts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    deck_id    text NOT NULL CHECK (length(deck_id) BETWEEN 1 AND 80),
    score      int NOT NULL CHECK (score >= 0),
    total      int NOT NULL CHECK (total > 0 AND score <= total),
    missed     text[] NOT NULL DEFAULT '{}',
    taken_at   timestamptz NOT NULL
);
CREATE INDEX quiz_attempts_family_member_idx ON quiz_attempts (family_id, member_id, taken_at DESC);

-- +goose Down
DROP TABLE quiz_attempts;
DROP TABLE library_reads;
