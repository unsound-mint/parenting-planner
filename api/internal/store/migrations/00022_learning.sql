-- +goose Up

-- Learning progress, quiz answers, couple talks and the baby name list. None of
-- it is sensitive: both parents see each other's reading and answers by design
-- (docs/product.md, couple layer), so there is no visibility column. Caregivers
-- never reach these tables: every endpoint is parents only.

-- One row per parent and lesson. lesson_id is a slug from the embedded catalog
-- (api/internal/content/learn_paths.json), not a foreign key.
CREATE TABLE lesson_reads (
    family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    lesson_id    text NOT NULL CHECK (length(lesson_id) BETWEEN 1 AND 80),
    started_at   timestamptz NOT NULL,
    finished_at  timestamptz,
    PRIMARY KEY (member_id, lesson_id),
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);
CREATE INDEX lesson_reads_family_finished_idx ON lesson_reads (family_id, finished_at DESC);

-- One answer per parent and question, so a couple compares first answers.
CREATE TABLE quiz_answers (
    family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    question_id  text NOT NULL CHECK (length(question_id) BETWEEN 1 AND 80),
    choice_id    text NOT NULL CHECK (length(choice_id) BETWEEN 1 AND 8),
    answered_at  timestamptz NOT NULL,
    PRIMARY KEY (member_id, question_id)
);
CREATE INDEX quiz_answers_family_answered_idx ON quiz_answers (family_id, answered_at DESC);

-- "We talked about it": one shared record per family and prompt.
CREATE TABLE couple_talks (
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    prompt_id   text NOT NULL CHECK (length(prompt_id) BETWEEN 1 AND 80),
    talked_by   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    talked_at   timestamptz NOT NULL,
    PRIMARY KEY (family_id, prompt_id)
);

CREATE TABLE baby_names (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    added_by    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL
);
CREATE UNIQUE INDEX baby_names_family_name_idx ON baby_names (family_id, lower(name));

CREATE TABLE baby_name_likes (
    name_id     uuid NOT NULL REFERENCES baby_names(id) ON DELETE CASCADE,
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL,
    PRIMARY KEY (name_id, member_id)
);

-- +goose Down
DROP TABLE baby_name_likes, baby_names, couple_talks, quiz_answers, lesson_reads;
