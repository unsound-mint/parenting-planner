-- Library reading state and quiz retakes are per parent: every query filters
-- by family and member, so one parent never sees the other's.

-- name: ListLibraryReads :many
SELECT * FROM library_reads WHERE family_id = @family_id AND member_id = @member_id;

-- read keeps the first read_at; saved sets or clears saved_at. A NULL flag leaves that column alone.
-- name: UpsertLibraryRead :one
INSERT INTO library_reads (family_id, member_id, topic_id, read_at, saved_at)
VALUES (@family_id, @member_id, @topic_id,
        CASE WHEN sqlc.narg(read)::bool THEN @at::timestamptz END,
        CASE WHEN sqlc.narg(saved)::bool THEN @at::timestamptz END)
ON CONFLICT (member_id, topic_id) DO UPDATE SET
    read_at = CASE
        WHEN sqlc.narg(read)::bool IS NULL THEN library_reads.read_at
        WHEN sqlc.narg(read)::bool THEN COALESCE(library_reads.read_at, @at::timestamptz)
    END,
    saved_at = CASE
        WHEN sqlc.narg(saved)::bool IS NULL THEN library_reads.saved_at
        WHEN sqlc.narg(saved)::bool THEN COALESCE(library_reads.saved_at, @at::timestamptz)
    END
WHERE library_reads.family_id = @family_id
RETURNING *;

-- name: CreateQuizAttempt :one
INSERT INTO quiz_attempts (family_id, member_id, deck_id, score, total, missed, taken_at)
VALUES (@family_id, @member_id, @deck_id, @score, @total, @missed, @taken_at)
RETURNING *;

-- Newest first, capped: the deck page shows the last few per deck.
-- name: ListQuizAttempts :many
SELECT * FROM quiz_attempts WHERE family_id = @family_id AND member_id = @member_id
ORDER BY taken_at DESC LIMIT 200;
