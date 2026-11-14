-- +goose Up
CREATE TABLE bag_items (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    list             text NOT NULL CHECK (list IN ('mother','baby','partner')),
    label            text NOT NULL,
    packer_member_id  uuid REFERENCES members(id) ON DELETE SET NULL,
    packed           boolean NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bag_items_family_idx ON bag_items (family_id, list, created_at);

-- +goose Down
DROP TABLE bag_items;
