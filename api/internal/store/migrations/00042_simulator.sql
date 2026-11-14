-- +goose Up
CREATE TABLE simulator_rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    mode text NOT NULL CHECK (mode IN ('scenario', 'practice')),
    scenario_id text,
    question_ids text[] NOT NULL CHECK (cardinality(question_ids) BETWEEN 1 AND 8),
    created_at timestamptz NOT NULL,
    completed_at timestamptz,
    UNIQUE (family_id, member_id, id),
    CHECK ((mode = 'scenario') = (scenario_id IS NOT NULL))
);
CREATE INDEX simulator_rounds_member ON simulator_rounds (family_id, member_id);
CREATE TABLE simulator_answers (
    family_id uuid NOT NULL,
    member_id uuid NOT NULL,
    round_id uuid NOT NULL,
    question_id text NOT NULL,
    choice_id text NOT NULL,
    skill text NOT NULL,
    correct boolean NOT NULL,
    answered_at timestamptz NOT NULL,
    PRIMARY KEY (family_id, member_id, round_id, question_id),
    FOREIGN KEY (family_id, member_id, round_id)
        REFERENCES simulator_rounds (family_id, member_id, id) ON DELETE CASCADE
);
-- +goose Down
DROP TABLE simulator_answers;
DROP TABLE simulator_rounds;
