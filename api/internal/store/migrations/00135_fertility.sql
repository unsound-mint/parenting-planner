-- +goose Up

-- Fertility data is the most sensitive data in the app. Everything here belongs to
-- one parent and is private unless that parent shares an item with the partner
-- (visibility 'partner'). There is no 'family' or 'care_team' level on purpose:
-- caregivers never see any of it. Free text is sealed like the diary.
--
-- kind and code:
--   period          code = spotting | light | medium | heavy (spotting does not start a cycle)
--   symptom         code = a symptom from the fixed list in internal/fertility
--   ovulation_test  code = negative | faint | positive
--   bbt             temp_c = basal body temperature in Celsius
--   test            a fertility test, done or planned (entry_date may be in the future); note = what and result
--   treatment_note  note = what the clinic said or prescribed
CREATE TABLE fertility_entries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner')),
    kind             text NOT NULL CHECK (kind IN ('period','symptom','ovulation_test','bbt','test','treatment_note')),
    entry_date       date NOT NULL,
    code             text,
    temp_c           numeric(4,2),
    note_sealed      bytea,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (kind <> 'bbt' OR temp_c BETWEEN 34 AND 40),
    CHECK (kind IN ('period','symptom','ovulation_test') = (code IS NOT NULL)),
    CHECK (kind NOT IN ('test','treatment_note') OR note_sealed IS NOT NULL)
);
CREATE INDEX fertility_entries_owner_date_idx ON fertility_entries (family_id, owner_member_id, entry_date DESC);

-- One tick per person and checklist item. The items themselves live in Go.
CREATE TABLE preconception_ticks (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner')),
    item_key         text NOT NULL,
    done_at          timestamptz NOT NULL,
    UNIQUE (owner_member_id, item_key)
);

-- Journey preferences of one parent. Always private to them; the only flag other
-- screens read is hide_baby_content, and they read it for the acting parent only.
CREATE TABLE journey_settings (
    owner_member_id      uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    family_id            uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    visibility           text NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
    hide_baby_content    boolean NOT NULL DEFAULT false,
    fertility_treatment  boolean NOT NULL DEFAULT false,
    previous_loss        boolean NOT NULL DEFAULT false,
    trying_since         date,
    updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journey_settings_family_idx ON journey_settings (family_id);

-- +goose Down
DROP TABLE journey_settings;
DROP TABLE preconception_ticks;
DROP TABLE fertility_entries;
