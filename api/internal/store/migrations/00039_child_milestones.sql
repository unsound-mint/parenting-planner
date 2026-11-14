-- +goose Up
CREATE TABLE child_milestones (
    family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    milestone_id text NOT NULL,
    observed_on date NOT NULL,
    set_by_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
    PRIMARY KEY (child_id, milestone_id)
);

-- +goose Down
DROP TABLE child_milestones;
