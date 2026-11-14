-- name: CreateAppointmentQuestion :one
INSERT INTO appointment_questions (family_id, owner_member_id, visibility, asked_for_event_id, body)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- Mirrors access.CanParentRead: the viewer's own questions, plus the other parent's
-- questions shared with the partner or the family. Answered ones only for the last 30 days.
-- name: ListAppointmentQuestionsVisibleToParent :many
SELECT * FROM appointment_questions
WHERE family_id = @family_id
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
  AND (NOT answered OR answered_at >= @answered_since)
ORDER BY seq;

-- Mirrors access.CanParentRead for an update: only the author, so another parent's shared
-- question cannot be found (and does not reveal that it exists). Locks the row.
-- name: GetOwnAppointmentQuestionVisibleToParent :one
SELECT * FROM appointment_questions
WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id
FOR UPDATE;

-- Mirrors access.CanParentRead for an update: only the author.
-- name: AnswerAppointmentQuestionVisibleToParent :one
UPDATE appointment_questions SET answered = @answered, answer = @answer, answered_at = @answered_at
WHERE id = @id AND owner_member_id = @viewer_id RETURNING *;

-- Mirrors access.CanParentRead: appointments the viewer may see (their own, or family
-- visibility), with the people attending, past and upcoming.
-- name: ListAppointmentEventsVisibleToParent :many
SELECT e.*,
       COALESCE((SELECT array_agg(a.member_id) FROM calendar_event_attendees a WHERE a.event_id = e.id), '{}')::uuid[] AS attendee_ids
FROM calendar_events e
WHERE e.family_id = @family_id AND e.kind = 'appointment'
  AND (e.owner_member_id = @viewer_id OR e.visibility = 'family')
ORDER BY e.starts_at, e.id;
