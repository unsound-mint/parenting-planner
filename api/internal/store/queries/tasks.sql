-- name: CreateTask :one
INSERT INTO tasks (family_id, kind, title, detail, due_on, due_anchor, due_offset_days, bag, assignee_member_id,
                   source_title, source_url, source_checked_on, created_by_member_id)
VALUES (@family_id, @kind, @title, @detail, @due_on, @due_anchor, @due_offset_days, @bag, @assignee_member_id,
        @source_title, @source_url, @source_checked_on, @created_by_member_id)
RETURNING *;

-- name: ListTasks :many
SELECT * FROM tasks
WHERE family_id = @family_id AND (sqlc.narg(kind)::text IS NULL OR kind = sqlc.narg(kind)::text)
ORDER BY seq;

-- Locks the row so two parents cannot accept and decline the same offer at once.
-- name: GetTaskForUpdate :one
SELECT * FROM tasks WHERE id = $1 AND family_id = $2 FOR UPDATE;

-- name: SetTaskDone :one
UPDATE tasks SET done = $2, done_at = $3, done_by_member_id = $4 WHERE id = $1 RETURNING *;

-- name: SetTaskPendingAssignee :one
UPDATE tasks SET pending_assignee_member_id = $2 WHERE id = $1 RETURNING *;

-- name: AcceptTaskReassignment :one
UPDATE tasks SET assignee_member_id = pending_assignee_member_id, pending_assignee_member_id = NULL
WHERE id = $1 AND pending_assignee_member_id IS NOT NULL RETURNING *;
