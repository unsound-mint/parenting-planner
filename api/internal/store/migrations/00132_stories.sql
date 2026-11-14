-- +goose Up

-- Picture-book stories a parent makes from memories they chose. A story is
-- private to its author until they share it with the other parent (per story);
-- caregivers never see stories. memories holds the short lines the parent
-- picked (a JSON array of strings), pages the finished book (a JSON array of
-- {"text", "art"}). generated_by says whether the Claude API or the built-in
-- template wrote it.
CREATE TABLE stories (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner')),
    child_id         uuid REFERENCES children(id) ON DELETE SET NULL,
    child_name       text NOT NULL,
    age_months       integer CHECK (age_months >= 0),
    theme            text NOT NULL CHECK (theme IN ('bedtime','adventure','born','sibling')),
    signed_as        text NOT NULL,
    title            text NOT NULL,
    memories         jsonb NOT NULL,
    pages            jsonb NOT NULL,
    generated_by     text NOT NULL CHECK (generated_by IN ('ai','template')),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stories_family_created_idx ON stories (family_id, created_at DESC);

-- +goose Down
DROP TABLE stories;
