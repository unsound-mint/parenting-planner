-- +goose Up
-- The monthly portrait flipbook: a child's portrait by age in months, or a
-- bump photo by pregnancy week (child_id NULL). Family-shared like the care
-- log; caregivers see children's portraits with baby_passport and the bump
-- with pregnancy_updates (portraits.Person.CanSee). A photo holds the image
-- re-encoded by the server, so no EXIF or location is ever stored; a seeded
-- illustration has no image and the web draws it. Rows go with the family
-- (ON DELETE CASCADE) and with an old demo when its browser starts a new one.
CREATE TABLE portraits (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    child_id           uuid REFERENCES children(id) ON DELETE CASCADE,
    month              smallint CHECK (month BETWEEN 0 AND 72),
    week               smallint CHECK (week BETWEEN 4 AND 42),
    kind               text NOT NULL CHECK (kind IN ('photo','illustration')),
    uploader_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
    width              integer,
    height             integer,
    image              bytea,
    created_at         timestamptz NOT NULL,
    CHECK ((child_id IS NOT NULL AND month IS NOT NULL AND week IS NULL)
        OR (child_id IS NULL AND week IS NOT NULL AND month IS NULL)),
    CHECK ((kind = 'photo') = (image IS NOT NULL)),
    CHECK (kind = 'illustration' OR (width BETWEEN 1 AND 4096 AND height BETWEEN 1 AND 4096))
);
-- The image is already compressed; skip Postgres's own compression.
ALTER TABLE portraits ALTER COLUMN image SET STORAGE EXTERNAL;
-- One portrait per slot.
CREATE UNIQUE INDEX portraits_child_month_idx ON portraits (child_id, month) WHERE child_id IS NOT NULL;
CREATE UNIQUE INDEX portraits_bump_week_idx ON portraits (family_id, week) WHERE child_id IS NULL;
CREATE INDEX portraits_family_idx ON portraits (family_id);

-- +goose Down
DROP TABLE portraits;
