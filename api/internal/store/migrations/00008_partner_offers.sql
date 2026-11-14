-- +goose Up

-- Partner offers shown to parents in their own "Partner offer" block. Each demo
-- family has its own copy, edited from the admin panel. Targeting is by the
-- family's stage and the parent's role only, never by health data.
CREATE TABLE partner_offers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    partner_name  text NOT NULL,
    title         text NOT NULL,
    detail        text NOT NULL,
    url           text NOT NULL CHECK (url LIKE 'https://%'),
    stages        text[] NOT NULL CHECK (cardinality(stages) > 0 AND stages <@ ARRAY['planning','trying','pregnancy','postpartum','infant','toddler','preschool','school_age']),
    audience      text[] NOT NULL CHECK (cardinality(audience) > 0 AND audience <@ ARRAY['mother','partner']),
    active        boolean NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_offers_family_created_idx ON partner_offers (family_id, created_at DESC);

-- One row per click, for aggregate counts. Only the offer, the family and the
-- time: no member, so nobody can see who clicked.
CREATE TABLE partner_offer_clicks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    offer_id    uuid NOT NULL REFERENCES partner_offers(id) ON DELETE CASCADE,
    clicked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_offer_clicks_offer_idx ON partner_offer_clicks (offer_id);
CREATE INDEX partner_offer_clicks_clicked_idx ON partner_offer_clicks (clicked_at);

-- +goose Down
DROP TABLE partner_offer_clicks;
DROP TABLE partner_offers;
