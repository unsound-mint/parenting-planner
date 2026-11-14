-- +goose Up

-- Parenting Compatibility Lab: one answer per parent and scenario card. card_id is
-- a slug from the embedded catalog (internal/couplelab), not a foreign key.
-- The column is member_id, not owner_member_id, on purpose: the visibility is not
-- chosen by the author. A parent's answer is readable by the other parent only once
-- that parent has answered the same card (ListLabAnswersRevealedToParent).
CREATE TABLE lab_answers (
    family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    card_id      text NOT NULL CHECK (length(card_id) BETWEEN 1 AND 60),
    choice_id    text NOT NULL CHECK (choice_id IN ('a','b','c','d','other')),
    other_text   text CHECK (other_text IS NULL OR length(other_text) BETWEEN 1 AND 300),
    answered_at  timestamptz NOT NULL,
    PRIMARY KEY (member_id, card_id),
    CHECK ((choice_id = 'other') OR other_text IS NULL)
);
CREATE INDEX lab_answers_family_card_idx ON lab_answers (family_id, card_id);

-- Letters to a child, opened at a chosen date. The text is encrypted like the diary.
-- The partner sees that a letter exists (occasion, opening date) but gets the text
-- only when the author set visibility to partner.
CREATE TABLE time_capsule_letters (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    child_id         uuid REFERENCES children(id) ON DELETE SET NULL,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner')),
    occasion         text NOT NULL CHECK (length(occasion) BETWEEN 1 AND 60),
    opens_on         date NOT NULL,
    body_sealed      bytea NOT NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NOT NULL
);
CREATE INDEX time_capsule_letters_family_opens_idx ON time_capsule_letters (family_id, opens_on);

-- +goose Down
DROP TABLE time_capsule_letters, lab_answers;
