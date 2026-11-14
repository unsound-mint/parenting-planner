-- Mirrors access.CanParentRead with private visibility: only the author.
-- name: GetAppointmentNoteVisibleToParent :one
SELECT body, updated_at FROM appointment_notes
WHERE family_id = $1 AND author_id = $2 AND appointment_id = $3;

-- name: SaveAppointmentNote :one
INSERT INTO appointment_notes (family_id, author_id, appointment_id, body, updated_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (author_id, appointment_id) DO UPDATE
SET body = EXCLUDED.body, updated_at = EXCLUDED.updated_at
WHERE appointment_notes.family_id = EXCLUDED.family_id
RETURNING body, updated_at;

-- name: DeleteAppointmentNote :exec
DELETE FROM appointment_notes
WHERE family_id = $1 AND author_id = $2 AND appointment_id = $3;

-- Mirrors access.CanParentRead: the parent's own visit or one shared with family.
-- name: GetAppointmentEventVisibleToParent :one
SELECT e.*,
       COALESCE((SELECT array_agg(a.member_id) FROM calendar_event_attendees a
                 WHERE a.event_id = e.id), '{}')::uuid[] AS attendee_ids
FROM calendar_events e
WHERE e.family_id = @family_id AND e.id = @id AND e.kind = 'appointment'
  AND (e.owner_member_id = @viewer_id OR e.visibility = 'family');

-- Mirrors access.CanParentRead: private questions stay with their author.
-- name: ListPrepQuestionsVisibleToParent :many
SELECT * FROM appointment_questions
WHERE family_id = @family_id AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
  AND created_at <= @as_of
ORDER BY seq;
