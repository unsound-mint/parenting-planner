-- name: CreateCalendarEvent :one
INSERT INTO calendar_events (family_id, owner_member_id, visibility, kind, title, starts_at, ends_at, all_day, location)
VALUES (@family_id, @owner_member_id, @visibility, @kind, @title, @starts_at, @ends_at, @all_day, @location)
RETURNING *;

-- Mirrors access.CanParentRead: own events, plus events shared with the family.
-- name: GetAppointmentVisibleToParent :one
SELECT * FROM calendar_events
WHERE id = @id
  AND family_id = @family_id
  AND kind = 'appointment'
  AND (owner_member_id = @viewer_id OR visibility = 'family');

-- The next upcoming appointment, the viewer's own before anyone else's.
-- Mirrors access.CanParentRead: own events, plus events shared with the family.
-- name: NextAppointmentVisibleToParent :one
SELECT * FROM calendar_events
WHERE family_id = @family_id
  AND kind = 'appointment'
  AND starts_at > @now
  AND (owner_member_id = @viewer_id OR visibility = 'family')
ORDER BY COALESCE(owner_member_id = @viewer_id::uuid, false) DESC, starts_at
LIMIT 1;

-- Mirrors access.CanParentRead: own events, plus events shared with the family.
-- name: ListUpcomingAppointmentsVisibleToParent :many
SELECT * FROM calendar_events
WHERE family_id = @family_id
  AND kind = 'appointment'
  AND starts_at > @now
  AND id = ANY(@ids::uuid[])
  AND (owner_member_id = @viewer_id OR visibility = 'family')
ORDER BY starts_at;
