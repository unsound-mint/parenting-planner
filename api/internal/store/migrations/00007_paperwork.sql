-- +goose Up
-- The catalog of items lives in internal/paperwork; a row exists once someone
-- ticks an item or picks who handles it.
CREATE TABLE paperwork_items (
    family_id           uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    key                 text NOT NULL,
    assignee_member_id  uuid REFERENCES members(id) ON DELETE SET NULL,
    done                boolean NOT NULL DEFAULT false,
    PRIMARY KEY (family_id, key)
);

-- +goose Down
DROP TABLE paperwork_items;
