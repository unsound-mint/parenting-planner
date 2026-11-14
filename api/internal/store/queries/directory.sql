-- The directory is global synthetic data, not family data, so it has no family filter.
-- name: ListProviders :many
SELECT id, name, type, city, state, languages, price_usd, summary, credentials, bio, visit_modes, session_minutes
FROM providers
WHERE (sqlc.narg(type)::text IS NULL OR type = sqlc.narg(type)::text)
  AND (sqlc.narg(state)::text IS NULL OR state = sqlc.narg(state)::text)
ORDER BY name;

-- name: GetProviderSlotsThrough :one
SELECT provider_slots_through FROM families WHERE id = @family_id;

-- Fills the family's open times from from_day through to_day: every provider,
-- at fixed Eastern hours, Monday to Friday (Saturdays too for doulas,
-- lactation and sleep help, who visit at home). A stable hash of provider, day
-- and hour picks openings_pct of those hours, so a busy provider has few open
-- times and rerunning it adds nothing new.
-- name: FillProviderSlots :exec
INSERT INTO provider_slots (family_id, provider_id, starts_at, duration_minutes)
SELECT @family_id::uuid, p.id, (d::date + make_interval(hours => h)) AT TIME ZONE 'America/New_York', p.session_minutes
FROM providers p
CROSS JOIN generate_series(@from_day::date, @to_day::date, interval '1 day') AS d
CROSS JOIN unnest(ARRAY[9, 10, 11, 13, 14, 15, 16, 17]) AS h
WHERE (extract(isodow FROM d) <= 5
       OR (extract(isodow FROM d) = 6 AND p.type IN ('doula', 'lactation_consultant', 'sleep_consultant')))
  AND abs(hashtext(p.id::text || d::date::text || h::text)) % 100 < p.openings_pct
ON CONFLICT (family_id, provider_id, starts_at) DO NOTHING;

-- name: SetProviderSlotsThrough :exec
UPDATE families SET provider_slots_through = @through::date WHERE id = @family_id;

-- Open times in the window. A time is gone for the viewer when they booked it,
-- or when anyone booked it and shared the booking with the family.
-- Mirrors access.CanParentRead: a private booking of the partner hides nothing,
-- so the list never reveals that the partner booked care.
-- name: ListOpenProviderSlotsVisibleToParent :many
SELECT s.id, s.provider_id, s.starts_at, s.duration_minutes
FROM provider_slots s
WHERE s.family_id = @family_id
  AND s.starts_at > @from_time
  AND s.starts_at <= @to_time
  AND (sqlc.narg(provider_id)::uuid IS NULL OR s.provider_id = sqlc.narg(provider_id)::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM provider_bookings b
    WHERE b.slot_id = s.id AND b.family_id = s.family_id
      AND (b.owner_member_id = @viewer_id OR b.visibility IN ('partner', 'family'))
  )
ORDER BY s.starts_at;

-- Books an open, future slot of the family. No row back means the time is
-- gone: unknown, in the past, booked by this parent, or booked and shared by
-- the partner (the same rule as ListOpenProviderSlotsVisibleToParent).
-- Mirrors access.CanParentRead: the open check reads own and shared bookings only.
-- name: CreateProviderBookingVisibleToParent :one
INSERT INTO provider_bookings (family_id, owner_member_id, visibility, slot_id, note, created_at)
SELECT s.family_id, @owner_member_id::uuid, @visibility::text, s.id, sqlc.narg(note)::text, @now::timestamptz
FROM provider_slots s
WHERE s.id = @slot_id AND s.family_id = @family_id AND s.starts_at > @now::timestamptz
  AND NOT EXISTS (
    SELECT 1 FROM provider_bookings b
    WHERE b.slot_id = s.id AND b.family_id = s.family_id
      AND (b.owner_member_id = @owner_member_id::uuid OR b.visibility IN ('partner', 'family'))
  )
ON CONFLICT (owner_member_id, slot_id) DO NOTHING
RETURNING id;

-- Mirrors access.CanParentRead: own bookings, plus the partner's shared ones.
-- name: ListProviderBookingsVisibleToParent :many
SELECT b.id, b.owner_member_id, b.visibility, b.note, b.created_at,
       s.provider_id, s.starts_at, s.duration_minutes, p.name AS provider_name
FROM provider_bookings b
JOIN provider_slots s ON s.id = b.slot_id
JOIN providers p ON p.id = s.provider_id
WHERE b.family_id = @family_id
  AND (b.owner_member_id = @viewer_id OR b.visibility IN ('partner', 'family'))
  AND s.starts_at >= @from_time
  AND s.starts_at < @to_time
ORDER BY s.starts_at;

-- The owner's own booking, for a move, an edit or a cancel.
-- Mirrors access.CanParentRead, narrowed to the owner: only they change a booking.
-- name: GetOwnProviderBookingVisibleToParent :one
SELECT b.id, b.visibility, b.note, s.provider_id, s.starts_at
FROM provider_bookings b
JOIN provider_slots s ON s.id = b.slot_id
WHERE b.id = @id AND b.family_id = @family_id AND b.owner_member_id = @owner_member_id;

-- Moves a booking to another open, future time with the same provider.
-- No row back means the new time is gone (same rule as CreateProviderBooking).
-- Mirrors access.CanParentRead: the open check reads own and shared bookings only.
-- name: MoveProviderBookingVisibleToParent :one
UPDATE provider_bookings b SET slot_id = s.id
FROM provider_slots s
WHERE b.id = @id AND b.family_id = @family_id AND b.owner_member_id = @owner_member_id
  AND s.id = @slot_id AND s.family_id = b.family_id AND s.provider_id = @provider_id AND s.starts_at > @now::timestamptz
  AND NOT EXISTS (
    SELECT 1 FROM provider_bookings o
    WHERE o.slot_id = s.id AND o.family_id = s.family_id AND o.id <> b.id
      AND (o.owner_member_id = @owner_member_id OR o.visibility IN ('partner', 'family'))
  )
RETURNING b.id;

-- name: UpdateProviderBookingDetails :exec
UPDATE provider_bookings SET visibility = @visibility, note = sqlc.narg(note)
WHERE id = @id AND family_id = @family_id AND owner_member_id = @owner_member_id;

-- name: DeleteProviderBooking :execrows
DELETE FROM provider_bookings
WHERE id = @id AND family_id = @family_id AND owner_member_id = @owner_member_id;

-- One booking in the list's shape, after a create or an update.
-- Mirrors access.CanParentRead, like ListProviderBookingsVisibleToParent.
-- name: GetProviderBookingVisibleToParent :one
SELECT b.id, b.owner_member_id, b.visibility, b.note, b.created_at,
       s.provider_id, s.starts_at, s.duration_minutes, p.name AS provider_name
FROM provider_bookings b
JOIN provider_slots s ON s.id = b.slot_id
JOIN providers p ON p.id = s.provider_id
WHERE b.id = @id AND b.family_id = @family_id
  AND (b.owner_member_id = @viewer_id OR b.visibility IN ('partner', 'family'));
