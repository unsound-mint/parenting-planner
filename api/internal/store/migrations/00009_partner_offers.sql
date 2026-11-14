-- +goose Up

-- Partner offers shown to a family. The admin panel edits this family's copy.
-- Targeting is by stage and role only, never by health data. Invented partners.
CREATE TABLE partner_offers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq           bigint GENERATED ALWAYS AS IDENTITY,
    family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    partner_name  text NOT NULL,
    title         text NOT NULL,
    detail        text NOT NULL,
    url           text NOT NULL,
    stages        text[] NOT NULL CHECK (stages <@ ARRAY['planning','trying','pregnancy','postpartum','infant','toddler','preschool','school_age']),
    audience      text[] NOT NULL CHECK (audience <@ ARRAY['mother','partner']),
    active        boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_offers_family_idx ON partner_offers (family_id, seq);

-- A click stores only the offer, the family and the time, for the analytics dashboard.
CREATE TABLE partner_offer_clicks (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offer_id    uuid NOT NULL REFERENCES partner_offers(id) ON DELETE CASCADE,
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    clicked_at  timestamptz NOT NULL
);
CREATE INDEX partner_offer_clicks_offer_idx ON partner_offer_clicks (offer_id);

-- +goose Down
DROP TABLE partner_offer_clicks, partner_offers;
