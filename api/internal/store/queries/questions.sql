-- name: CreateAppointmentQuestion :one
INSERT INTO appointment_questions (family_id, owner_member_id, visibility, appointment_id, text)
VALUES (@family_id, @owner_member_id, @visibility, @appointment_id, @text)
RETURNING *;

-- Only the author's own question; a 0-row result is the caller's 404.
-- name: AnswerAppointmentQuestion :one
UPDATE appointment_questions
SET answered_at = @answered_at, answer = @answer
WHERE id = @id AND family_id = @family_id AND owner_member_id = @owner_id
RETURNING id;

-- next_appointment_id is the next upcoming appointment of the same owner that
-- the viewer may see (the nil uuid when there is none yet; sqlc cannot type a nullable scalar subquery): where an unanswered
-- question of a past appointment is carried to. Pass a NULL question_id to list all.
-- Mirrors access.CanParentRead: own questions and events, plus ones shared with the partner or the family.
-- name: ListAppointmentQuestionsVisibleToParent :many
SELECT q.*,
       orig.starts_at AS appointment_starts_at,
       COALESCE((SELECT e.id FROM calendar_events e
        WHERE e.family_id = q.family_id
          AND e.kind = 'appointment'
          AND e.starts_at > @now::timestamptz
          AND e.owner_member_id IS NOT DISTINCT FROM orig.owner_member_id
          AND (e.owner_member_id = @viewer_id::uuid OR e.visibility = 'family')
        ORDER BY e.starts_at
        LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid)::uuid AS next_appointment_id
FROM appointment_questions q
JOIN calendar_events orig ON orig.id = q.appointment_id
WHERE q.family_id = @family_id
  AND (q.owner_member_id = @viewer_id::uuid OR q.visibility IN ('partner', 'family'))
  AND (q.answered_at IS NULL OR q.answered_at >= @since::timestamptz)
  AND (sqlc.narg('question_id')::uuid IS NULL OR q.id = sqlc.narg('question_id'))
ORDER BY q.created_at;
