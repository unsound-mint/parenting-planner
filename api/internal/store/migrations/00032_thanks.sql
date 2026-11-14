-- +goose Up

-- Thank-you notes. Written by a parent to the other parent or to a caregiver,
-- from a suggestion the data made. Not sensitive health data: both parents read
-- every note, a caregiver reads only the notes addressed to them. suggestion_key
-- names the thing being thanked, so it is thanked once per family.
CREATE TABLE thanks (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    from_member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    to_member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 400),
    suggestion_key   text,
    created_at       timestamptz NOT NULL,
    CHECK (from_member_id <> to_member_id)
);
CREATE INDEX thanks_family_created_idx ON thanks (family_id, created_at DESC);
CREATE UNIQUE INDEX thanks_family_key_idx ON thanks (family_id, suggestion_key) WHERE suggestion_key IS NOT NULL;

-- +goose Down
DROP TABLE thanks;
