-- name: CreatePartnerOffer :one
INSERT INTO partner_offers (family_id, partner_name, title, detail, url, stages, audience, active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;

-- Active offers for a stage and a role, in the order they were added. Stage and role only.
-- name: ListMatchingPartnerOffers :many
SELECT * FROM partner_offers
WHERE family_id = @family_id AND active AND @stage::text = ANY(stages) AND @role::text = ANY(audience)
ORDER BY seq
LIMIT 3;

-- name: GetPartnerOffer :one
SELECT * FROM partner_offers WHERE id = $1 AND family_id = $2;

-- name: CreatePartnerOfferClick :exec
INSERT INTO partner_offer_clicks (offer_id, family_id, clicked_at) VALUES ($1, $2, $3);

-- Every offer of the family, newest first, with its click count.
-- name: ListAllPartnerOffersWithClicks :many
SELECT o.*, (SELECT count(*) FROM partner_offer_clicks c WHERE c.offer_id = o.id)::bigint AS clicks
FROM partner_offers o WHERE o.family_id = $1 ORDER BY o.seq DESC;

-- Only the fields that are sent change.
-- name: UpdatePartnerOffer :one
UPDATE partner_offers SET
    partner_name = COALESCE(sqlc.narg(partner_name), partner_name),
    title        = COALESCE(sqlc.narg(title), title),
    detail       = COALESCE(sqlc.narg(detail), detail),
    url          = COALESCE(sqlc.narg(url), url),
    stages       = COALESCE(sqlc.narg(stages)::text[], stages),
    audience     = COALESCE(sqlc.narg(audience)::text[], audience),
    active       = COALESCE(sqlc.narg(active), active)
WHERE id = @id AND family_id = @family_id RETURNING *;
