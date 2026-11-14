-- +goose Up

-- Feeds, sleeps and diapers for the baby. Not a per-parent record: everyone with
-- the care_log permission sees every entry, so there is no owner or visibility.
CREATE TABLE care_log_entries (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    child_id          uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    author_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind              text NOT NULL CHECK (kind IN ('feed','sleep','diaper')),
    started_at        timestamptz NOT NULL,
    ended_at          timestamptz,
    feed_method       text CHECK (feed_method IN ('breast_left','breast_right','bottle_breast_milk','bottle_formula')),
    amount_ml         smallint CHECK (amount_ml BETWEEN 0 AND 400),
    diaper            text CHECK (diaper IN ('wet','dirty','both')),
    note              text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX care_log_family_started_idx ON care_log_entries (family_id, started_at DESC);
CREATE INDEX care_log_family_kind_started_idx ON care_log_entries (family_id, kind, started_at DESC);

-- A person hands the baby to another, with a note. shift_id has no foreign key
-- yet: shifts are a separate module.
CREATE TABLE handoffs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    from_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    to_member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    note            text,
    shift_id        uuid,
    status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    accepted_at     timestamptz,
    CHECK (from_member_id <> to_member_id)
);
CREATE INDEX handoffs_family_created_idx ON handoffs (family_id, created_at DESC);

-- +goose Down
DROP TABLE handoffs, care_log_entries;
