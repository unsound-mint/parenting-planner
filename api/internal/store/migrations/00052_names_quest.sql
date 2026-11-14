-- +goose Up

-- The names quest (api/internal/together/quest.go). Each parent answers names
-- from the catalog (api/internal/content/baby_names.json) or added by hand on
-- their own. A swipe is that parent's answer and stays out of the shared list:
-- only when both parents love a name does it join baby_names, liked by both. So
-- the shared list, likes and the partner nudge never show an answer the other
-- parent has not matched. Reads of the other parent's swipes go through
-- together.Visible: only on names the reader has answered too. Caregivers never
-- reach these tables (every endpoint is parents only).
CREATE TABLE baby_name_swipes (
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    verdict     text NOT NULL CHECK (verdict IN ('love', 'maybe', 'no')),
    swiped_at   timestamptz NOT NULL
);
CREATE UNIQUE INDEX baby_name_swipes_member_name_idx ON baby_name_swipes (family_id, member_id, lower(name));

-- The lists the couple builds the deck from, shared by both parents.
CREATE TABLE names_quests (
    family_id    uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    lists        text[] NOT NULL CHECK (cardinality(lists) BETWEEN 1 AND 20),
    updated_by   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    updated_at   timestamptz NOT NULL
);

-- Final round: one pick per parent and pair of matched names. low_id < high_id
-- so a pair has one row per parent whichever way round it was shown.
CREATE TABLE baby_name_duels (
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    low_id      uuid NOT NULL REFERENCES baby_names(id) ON DELETE CASCADE,
    high_id     uuid NOT NULL REFERENCES baby_names(id) ON DELETE CASCADE,
    winner_id   uuid NOT NULL REFERENCES baby_names(id) ON DELETE CASCADE,
    judged_at   timestamptz NOT NULL,
    PRIMARY KEY (member_id, low_id, high_id),
    CHECK (low_id < high_id),
    CHECK (winner_id = low_id OR winner_id = high_id)
);
CREATE INDEX baby_name_duels_family_idx ON baby_name_duels (family_id);

-- +goose Down
DROP TABLE baby_name_duels, names_quests, baby_name_swipes;
