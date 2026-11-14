-- name: CreatePartnerOffer :one
INSERT INTO partner_offers (family_id, partner_name, title, detail, url, stages, audience, active, created_at, updated_at)
VALUES (@family_id, @partner_name, @title, @detail, @url, @stages::text[], @audience::text[], @active, @created_at, @created_at)
RETURNING *;

-- Targeting uses the family's stage and the parent's role only, never health data.
-- name: ListPartnerOffersForParent :many
SELECT * FROM partner_offers
WHERE family_id = @family_id
  AND active
  AND @stage::text = ANY (stages)
  AND @role::text = ANY (audience)
ORDER BY created_at DESC, partner_name
LIMIT @max_items;

-- name: ListAllPartnerOffers :many
SELECT o.*, (SELECT count(*) FROM partner_offer_clicks c WHERE c.offer_id = o.id)::int AS clicks
FROM partner_offers o
WHERE o.family_id = @family_id
ORDER BY o.created_at DESC, o.partner_name;

-- name: GetPartnerOfferClicks :one
SELECT count(*)::int FROM partner_offer_clicks WHERE offer_id = @offer_id AND family_id = @family_id;

-- name: UpdatePartnerOffer :one
UPDATE partner_offers SET
    partner_name = coalesce(sqlc.narg(partner_name), partner_name),
    title        = coalesce(sqlc.narg(title), title),
    detail       = coalesce(sqlc.narg(detail), detail),
    url          = coalesce(sqlc.narg(url), url),
    stages       = coalesce(sqlc.narg(stages)::text[], stages),
    audience     = coalesce(sqlc.narg(audience)::text[], audience),
    active       = coalesce(sqlc.narg(active), active),
    updated_at   = @updated_at
WHERE id = @id AND family_id = @family_id
RETURNING *;

-- Only the offer, the family and the time; no member.
-- name: CreatePartnerOfferClick :execrows
INSERT INTO partner_offer_clicks (family_id, offer_id)
SELECT o.family_id, o.id FROM partner_offers o WHERE o.id = @offer_id AND o.family_id = @family_id;
