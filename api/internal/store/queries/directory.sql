-- The directory is global synthetic data, not family data, so it has no family filter.
-- name: ListProviders :many
SELECT id, name, type, city, state, languages, price_usd, summary,
       (sqlc.arg(today)::date + available_in_days)::date AS next_available
FROM providers
WHERE (sqlc.narg(type)::text IS NULL OR type = sqlc.narg(type)::text)
  AND (sqlc.narg(state)::text IS NULL OR state = sqlc.narg(state)::text)
ORDER BY available_in_days, name;

-- name: ProviderExists :one
SELECT EXISTS (SELECT 1 FROM providers WHERE id = @id);

-- name: CreateBookingRequest :one
INSERT INTO booking_requests (family_id, owner_member_id, visibility, provider_id, note, created_at)
VALUES (@family_id, @owner_member_id, 'private', @provider_id, @note, @created_at)
RETURNING *;

-- Mirrors access.CanParentRead, but stricter: the contract says a booking request
-- is visible only to the parent who made it, so only owner_member_id = viewer is
-- returned whatever the visibility (rows are always stored private anyway).
-- name: ListBookingRequestsVisibleToParent :many
SELECT * FROM booking_requests
WHERE family_id = @family_id
  AND owner_member_id = @viewer_id
ORDER BY created_at DESC;
