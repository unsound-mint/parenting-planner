-- created_at comes from the caller (the family's demo clock), like handoffs.
-- name: CreateThanks :one
INSERT INTO thanks (family_id, from_member_id, to_member_id, body, suggestion_key, created_at)
VALUES (@family_id, @from_member_id, @to_member_id, @body, @suggestion_key, @created_at)
RETURNING *;

-- Every note of the family: parents only (the handler checks the role).
-- name: ListThanks :many
SELECT * FROM thanks WHERE family_id = @family_id AND created_at >= @since ORDER BY created_at DESC, id LIMIT 50;

-- A caregiver reads only what is addressed to them.
-- name: ListThanksToMember :many
SELECT * FROM thanks WHERE family_id = @family_id AND to_member_id = @to_member_id AND created_at >= @since
ORDER BY created_at DESC, id LIMIT 50;

-- Keys already thanked, so a suggestion is offered once.
-- name: ListThanksKeys :many
SELECT suggestion_key FROM thanks WHERE family_id = @family_id AND suggestion_key IS NOT NULL;
