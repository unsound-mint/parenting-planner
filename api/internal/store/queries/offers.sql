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
