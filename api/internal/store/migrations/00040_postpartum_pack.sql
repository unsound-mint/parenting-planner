-- +goose Up

-- Per-parent setting: show only the essentials (next feed estimate, medicines,
-- appointments) and hide detailed tracking. Not sensitive, so no visibility.
ALTER TABLE members ADD COLUMN essentials_only boolean NOT NULL DEFAULT false;

-- A mother's own recovery check-in after birth. Private to her unless she shares
-- one with her partner; a caregiver never reads these. Urgent warning signs she
-- ticks are stored, but the urgent flag is computed on read (rules.RecoveryUrgent).
CREATE TABLE recovery_checkins (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    recorded_at      timestamptz NOT NULL,
    bleeding         text NOT NULL CHECK (bleeding IN ('none','spotting','light','moderate','heavy')),
    pain             smallint NOT NULL CHECK (pain BETWEEN 0 AND 10),
    wound            text NOT NULL CHECK (wound IN ('not_applicable','healing_well','sore','red_or_leaking')),
    breasts          text NOT NULL CHECK (breasts IN ('comfortable','full','sore','not_applicable')),
    pelvic_floor     text NOT NULL CHECK (pelvic_floor IN ('fine','leaking','heaviness','painful')),
    sleep_hours      real NOT NULL CHECK (sleep_hours BETWEEN 0 AND 24),
    mood             smallint CHECK (mood BETWEEN 1 AND 5),
    warning_signs    text[] NOT NULL DEFAULT '{}'
        CHECK (warning_signs <@ ARRAY['heavy_bleeding','fever','severe_headache','chest_pain','trouble_breathing','leg_swelling_pain','self_harm_thoughts']),
    note             text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recovery_checkins_family_recorded_idx ON recovery_checkins (family_id, recorded_at DESC);

-- What the family keeps at home for the baby. Shared by both parents; a
-- caregiver with the care_log permission may read it and tick the shopping list.
-- per_use is how many units one tracked event uses (a diaper change uses 1 diaper
-- and, say, 3 wipes); diapers, wipes and formula are counted from the care log.
CREATE TABLE supply_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name        text NOT NULL,
    category    text NOT NULL CHECK (category IN ('diapers','wipes','formula','medicine','clothing','other')),
    quantity    integer NOT NULL CHECK (quantity >= 0),
    unit        text NOT NULL DEFAULT 'pcs',
    low_at      integer NOT NULL DEFAULT 0 CHECK (low_at >= 0),
    per_use     smallint NOT NULL DEFAULT 1 CHECK (per_use BETWEEN 1 AND 20),
    size        text,
    expires_on  date,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supply_items_family_idx ON supply_items (family_id, created_at);

CREATE TABLE shopping_items (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id           uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name                text NOT NULL,
    supply_item_id      uuid REFERENCES supply_items(id) ON DELETE SET NULL,
    restock_quantity    integer CHECK (restock_quantity > 0),
    added_by_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    done_by_member_id   uuid REFERENCES members(id) ON DELETE SET NULL,
    done_at             timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopping_items_family_idx ON shopping_items (family_id, created_at);

-- +goose Down
DROP TABLE shopping_items, supply_items, recovery_checkins;
ALTER TABLE members DROP COLUMN essentials_only;
