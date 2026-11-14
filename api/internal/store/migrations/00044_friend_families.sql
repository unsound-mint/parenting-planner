-- +goose Up

-- Friend families: two families connect by a code, both sides agree, and then
-- each sees only the updates the other's parents explicitly shared with
-- friends. Nothing else of a family (diary, mood, health, the plan, the child's
-- records) is ever readable by a friend. The reads are in queries/friends.sql,
-- the second deliberate read across families after analytics (see
-- docs/architecture.md); store/conventions_test.go keeps that file to these tables.

-- A demo copy brings its own synthetic friends: real family rows (so seeded and
-- real connections share one read path) that belong to the visitor's family and
-- go away with it. Analytics leaves them out.
ALTER TABLE families ADD COLUMN friend_of uuid REFERENCES families(id) ON DELETE CASCADE;
CREATE INDEX families_friend_of_idx ON families (friend_of) WHERE friend_of IS NOT NULL;

-- One active code per family, shown to its parents so they can pass it on.
-- Stored in clear: a code grants nothing by itself, it only lets the other
-- family send a request that this family must accept.
CREATE TABLE friend_codes (
    family_id   uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    code        text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$'),
    created_by  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL
);

-- requester entered addressee's code; the addressee accepts. accepted_at NULL
-- is a pending request, which reads nothing in either direction. Disconnecting,
-- declining and cancelling delete the row.
CREATE TABLE friend_connections (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_family   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    addressee_family   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    requested_by       uuid REFERENCES members(id) ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    accepted_at        timestamptz,
    CHECK (requester_family <> addressee_family)
);
CREATE UNIQUE INDEX friend_connections_pair_key ON friend_connections (LEAST(requester_family, addressee_family), GREATEST(requester_family, addressee_family));
CREATE INDEX friend_connections_addressee_idx ON friend_connections (addressee_family);

-- What a parent shared with friends, as a snapshot: its own text, never a link
-- to a diary entry, a mood, a milestone record or any health table. headline is
-- written by the server (a week card: "Week 25: about the size of a zucchini").
CREATE TABLE friend_updates (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    author_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind              text NOT NULL CHECK (kind IN ('moment','week','note')),
    headline          text,
    body              text NOT NULL CHECK (char_length(body) <= 280),
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX friend_updates_family_created_idx ON friend_updates (family_id, created_at DESC);

-- Preset supportive reactions only: no comments, no counts shown. One per
-- person per update; only the update's own family sees who reacted.
CREATE TABLE friend_reactions (
    update_id   uuid NOT NULL REFERENCES friend_updates(id) ON DELETE CASCADE,
    member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    reaction    text NOT NULL CHECK (reaction IN ('heart','hug','got_this')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (update_id, member_id)
);
CREATE INDEX friend_reactions_family_idx ON friend_reactions (family_id);

-- +goose Down
DROP TABLE friend_reactions;
DROP TABLE friend_updates;
DROP TABLE friend_connections;
DROP TABLE friend_codes;
ALTER TABLE families DROP COLUMN friend_of;
