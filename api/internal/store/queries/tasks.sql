-- name: CreateTask :one
INSERT INTO tasks (family_id, title, due_on, assignee_member_id, created_at)
VALUES (@family_id, @title, @due_on, @assignee_member_id, @created_at)
RETURNING *;

-- name: ListTasks :many
SELECT * FROM tasks
WHERE family_id = @family_id
ORDER BY due_on ASC NULLS LAST, created_at ASC;

-- name: GetTask :one
SELECT * FROM tasks WHERE id = @id AND family_id = @family_id;

-- Only the current assignee may offer the task; ownership does not change yet.
-- name: ProposeTaskAssignee :one
UPDATE tasks SET pending_assignee_member_id = @to_member_id
WHERE id = @id AND family_id = @family_id AND assignee_member_id = @actor_id
RETURNING *;

-- Only the proposed assignee may accept; this is the one place ownership moves.
-- name: AcceptTaskAssignee :one
UPDATE tasks SET assignee_member_id = pending_assignee_member_id, pending_assignee_member_id = NULL
WHERE id = @id AND family_id = @family_id AND pending_assignee_member_id = @actor_id
RETURNING *;

-- name: DeclineTaskAssignee :one
UPDATE tasks SET pending_assignee_member_id = NULL
WHERE id = @id AND family_id = @family_id AND pending_assignee_member_id = @actor_id
RETURNING *;
