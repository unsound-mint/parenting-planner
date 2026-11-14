-- name: CreateTrainingRound :one
INSERT INTO simulator_rounds (family_id, member_id, mode, scenario_id, question_ids, created_at)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: LockTrainingRound :one
-- Mirrors access.CanParentRead with Private visibility: only the acting owner.
SELECT * FROM simulator_rounds WHERE family_id = $1 AND member_id = $2 AND id = $3 FOR UPDATE;

-- name: CountTrainingRounds :one
SELECT count(*) FROM simulator_rounds WHERE family_id = $1 AND member_id = $2 AND completed_at IS NOT NULL;

-- name: ListTrainingAnswers :many
-- Mirrors access.CanParentRead with Private visibility: only the acting owner.
SELECT * FROM simulator_answers WHERE family_id = $1 AND member_id = $2 AND round_id = $3;

-- name: ListTrainingHistory :many
-- Mirrors access.CanParentRead with Private visibility: only the acting owner.
SELECT * FROM simulator_answers WHERE family_id = $1 AND member_id = $2
ORDER BY answered_at DESC, round_id DESC, question_id;

-- name: InsertTrainingAnswer :exec
INSERT INTO simulator_answers (family_id, member_id, round_id, question_id, choice_id, skill, correct, answered_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: CompleteTrainingRound :exec
UPDATE simulator_rounds SET completed_at = $4 WHERE family_id = $1 AND member_id = $2 AND id = $3;
