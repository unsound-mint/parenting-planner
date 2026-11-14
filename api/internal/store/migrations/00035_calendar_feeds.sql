-- +goose Up
CREATE TABLE calendar_feeds (
    family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    scope text NOT NULL CHECK (scope IN ('mine', 'family')),
    created_at timestamptz NOT NULL,
    last_fetched_at timestamptz,
    PRIMARY KEY (family_id, member_id)
);

-- +goose Down
DROP TABLE calendar_feeds;
