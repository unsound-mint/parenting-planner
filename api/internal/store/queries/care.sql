-- name: GetDemoPsychologist :one
SELECT * FROM psychologists ORDER BY name LIMIT 1;

-- name: ListPsychologists :many
SELECT * FROM psychologists;

-- name: CreatePsychologistSlot :one
INSERT INTO psychologist_slots (family_id, psychologist_id, starts_at, duration_minutes)
VALUES (@family_id, @psychologist_id, @starts_at, @duration_minutes)
RETURNING id;

-- Open slots in the window, minus the ones this parent already booked.
-- Mirrors access.CanParentRead: only the viewer's own bookings hide a slot, so nothing about the partner leaks.
-- name: ListOpenSlotsVisibleToParent :many
SELECT s.* FROM psychologist_slots s
WHERE s.family_id = @family_id
  AND s.starts_at > @from_time
  AND s.starts_at <= @to_time
  AND NOT EXISTS (
    SELECT 1 FROM psychologist_bookings b
    WHERE b.slot_id = s.id AND b.family_id = s.family_id AND b.owner_member_id = @viewer_id
  )
ORDER BY s.starts_at;

-- Books an open, future slot of the family. No row back means the slot is
-- gone: unknown, in the past, or already booked by this parent.
-- name: CreatePsychologistBooking :one
INSERT INTO psychologist_bookings (family_id, owner_member_id, visibility, slot_id)
SELECT s.family_id, @owner_member_id::uuid, 'private', s.id
FROM psychologist_slots s
WHERE s.id = @slot_id AND s.family_id = @family_id AND s.starts_at > @now
ON CONFLICT (owner_member_id, slot_id) DO NOTHING
RETURNING *;

-- Mirrors access.CanParentRead: own bookings, plus ones shared with the partner or the family (none today: bookings are stored private).
-- name: ListPsychologistBookingsVisibleToParent :many
SELECT b.id, b.owner_member_id, b.visibility, s.psychologist_id, s.starts_at, s.duration_minutes,
       EXISTS (
         SELECT 1 FROM session_notes n
         WHERE n.booking_id = b.id AND n.family_id = b.family_id AND n.owner_member_id = b.owner_member_id
       ) AS note_written
FROM psychologist_bookings b
JOIN psychologist_slots s ON s.id = b.slot_id
WHERE b.family_id = @family_id
  AND (b.owner_member_id = @viewer_id OR b.visibility IN ('partner', 'family'))
ORDER BY s.starts_at DESC;

-- name: CreateSessionNote :one
INSERT INTO session_notes (family_id, owner_member_id, visibility, booking_id, written_at, text)
VALUES (@family_id, @owner_member_id, 'private', @booking_id, @written_at, @text)
ON CONFLICT (booking_id) DO NOTHING
RETURNING *;

-- Mirrors access.CanParentRead: own notes, plus ones shared with the partner or the family (none today: notes are stored private).
-- name: ListSessionNotesVisibleToParent :many
SELECT * FROM session_notes
WHERE family_id = @family_id
  AND written_at >= @since
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY written_at DESC;

-- Moves the parent's own upcoming booking to another open future slot of the
-- family. No row back: the booking is not theirs, has started, or the slot is
-- gone (unknown, past, or already booked by this parent).
-- Mirrors access.CanParentRead for a change: only the author's own bookings.
-- name: MoveOwnPsychologistBookingVisibleToParent :one
UPDATE psychologist_bookings b SET slot_id = s.id
FROM psychologist_slots s, psychologist_slots cur
WHERE b.id = @id AND b.family_id = @family_id AND b.owner_member_id = @owner_member_id
  AND cur.id = b.slot_id AND cur.starts_at > @now
  AND s.id = @slot_id AND s.family_id = @family_id AND s.starts_at > @now
  AND NOT EXISTS (SELECT 1 FROM psychologist_bookings x WHERE x.owner_member_id = @owner_member_id AND x.slot_id = s.id)
RETURNING b.id;

-- name: DeleteOwnUpcomingPsychologistBooking :execrows
DELETE FROM psychologist_bookings b
USING psychologist_slots s
WHERE b.id = @id AND b.family_id = @family_id AND b.owner_member_id = @owner_member_id
  AND s.id = b.slot_id AND s.starts_at > @now;
