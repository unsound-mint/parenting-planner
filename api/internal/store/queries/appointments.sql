-- name: CreateAppointment :one
INSERT INTO appointments (family_id, with_name, starts_at) VALUES ($1, $2, $3) RETURNING *;

-- name: GetAppointment :one
SELECT * FROM appointments WHERE id = $1 AND family_id = $2;

-- name: ListAppointments :many
SELECT * FROM appointments WHERE family_id = $1 ORDER BY starts_at;

-- name: CreateAppointmentQuestion :one
INSERT INTO appointment_questions (family_id, appointment_id, body) VALUES ($1, $2, $3) RETURNING *;

-- name: ListAppointmentQuestions :many
SELECT * FROM appointment_questions WHERE family_id = $1 ORDER BY created_at;

-- name: SetQuestionAnswered :one
UPDATE appointment_questions SET answered = $3 WHERE id = $1 AND family_id = $2 RETURNING *;
