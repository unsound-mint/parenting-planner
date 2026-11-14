-- +goose Up

-- A questionnaire a parent started and has not finished. Private to its author: it never
-- scores, never feeds the plan and is never shown to anyone else, whatever visibility the
-- finished result gets later. One draft per parent and instrument; it expires after 14 days.
CREATE TABLE mood_screening_drafts (
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    -- Always private: there is nothing to widen. The column exists so the table follows the
    -- sensitive-table convention, and the CHECK keeps it that way.
    visibility       text NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
    instrument       text NOT NULL CHECK (instrument IN ('epds','phq9')),
    answers          smallint[] NOT NULL,
    updated_at       timestamptz NOT NULL,
    PRIMARY KEY (owner_member_id, instrument)
);

-- +goose Down
DROP TABLE mood_screening_drafts;
