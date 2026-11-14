-- name: CreateCalendarEvent :one
INSERT INTO calendar_events (family_id, owner_member_id, visibility, kind, title, starts_at, ends_at, all_day, location, neutral_title)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: AddCalendarEventAttendee :exec
INSERT INTO calendar_event_attendees (event_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- Mirrors access.CanParentRead: the viewer's own events, plus other parents' events
-- with visibility family (private is owner only).
-- name: ListCalendarEventsVisibleToParent :many
SELECT e.*,
       COALESCE((SELECT array_agg(a.member_id) FROM calendar_event_attendees a WHERE a.event_id = e.id), '{}')::uuid[] AS attendee_ids
FROM calendar_events e
WHERE e.family_id = @family_id
  AND e.starts_at >= @from_at AND e.starts_at < @to_at
  AND (e.owner_member_id = @viewer_id OR e.visibility = 'family')
ORDER BY e.starts_at, e.id;

-- Mirrors access.CanParentRead for a caregiver: only family-visible events they attend,
-- never a parent's appointments, never private events.
-- name: ListCaregiverCalendarEventsVisibleToParent :many
SELECT e.*,
       COALESCE((SELECT array_agg(a.member_id) FROM calendar_event_attendees a WHERE a.event_id = e.id), '{}')::uuid[] AS attendee_ids
FROM calendar_events e
WHERE e.family_id = @family_id
  AND e.starts_at >= @from_at AND e.starts_at < @to_at
  AND e.visibility = 'family' AND e.kind <> 'appointment'
  AND EXISTS (SELECT 1 FROM calendar_event_attendees a WHERE a.event_id = e.id AND a.member_id = @viewer_id)
ORDER BY e.starts_at, e.id;

-- Mirrors access.CanParentRead with private visibility: only the owner can update.
-- name: LockOwnedCalendarEventVisibleToParent :one
SELECT * FROM calendar_events
WHERE family_id = $1 AND owner_member_id = $2 AND id = $3
FOR UPDATE;

-- name: UpdateOwnedCalendarEvent :one
UPDATE calendar_events SET title = $4, starts_at = $5, ends_at = $6,
    all_day = $7, location = $8, visibility = $9, neutral_title = $10
WHERE family_id = $1 AND owner_member_id = $2 AND id = $3
RETURNING *;

-- name: CalendarEventAttendees :many
SELECT a.member_id FROM calendar_event_attendees a
JOIN calendar_events e ON e.id = a.event_id
WHERE e.family_id = $1 AND e.id = $2 ORDER BY a.member_id;

-- name: ClearCalendarEventAttendees :exec
DELETE FROM calendar_event_attendees a USING calendar_events e
WHERE e.family_id = $1 AND e.id = $2 AND a.event_id = e.id;
