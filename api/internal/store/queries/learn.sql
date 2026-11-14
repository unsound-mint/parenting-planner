-- Learning progress is shared between the two parents by design (both see each
-- other's reading and quiz answers); every query is scoped to one family.

-- name: ListLessonReads :many
SELECT * FROM lesson_reads WHERE family_id = @family_id;

-- name: StartLessonRead :one
INSERT INTO lesson_reads (family_id, member_id, lesson_id, started_at, finished_at)
VALUES (@family_id, @member_id, @lesson_id, @at, CASE WHEN @finished::bool THEN @at::timestamptz END)
ON CONFLICT (member_id, lesson_id) DO UPDATE
SET finished_at = CASE WHEN @finished::bool THEN COALESCE(lesson_reads.finished_at, @at::timestamptz) END
WHERE lesson_reads.family_id = @family_id
RETURNING *;

-- name: ListQuizAnswers :many
SELECT * FROM quiz_answers WHERE family_id = @family_id;

-- name: CreateQuizAnswer :one
INSERT INTO quiz_answers (family_id, member_id, question_id, choice_id, answered_at)
VALUES (@family_id, @member_id, @question_id, @choice_id, @answered_at)
ON CONFLICT (member_id, question_id) DO NOTHING
RETURNING *;

-- name: GetQuizAnswer :one
SELECT * FROM quiz_answers WHERE family_id = @family_id AND member_id = @member_id AND question_id = @question_id;

-- name: ListCoupleTalks :many
SELECT * FROM couple_talks WHERE family_id = @family_id;

-- Keeps the first record when the prompt was already marked.
-- name: CreateCoupleTalk :one
INSERT INTO couple_talks (family_id, prompt_id, talked_by, talked_at)
VALUES (@family_id, @prompt_id, @talked_by, @talked_at)
ON CONFLICT (family_id, prompt_id) DO UPDATE SET prompt_id = EXCLUDED.prompt_id
RETURNING *;

-- name: ListBabyNames :many
SELECT n.*, COALESCE(array_agg(l.member_id ORDER BY l.created_at) FILTER (WHERE l.member_id IS NOT NULL), '{}')::uuid[] AS liked_by
FROM baby_names n
LEFT JOIN baby_name_likes l ON l.name_id = n.id AND l.family_id = n.family_id
WHERE n.family_id = @family_id
GROUP BY n.id
ORDER BY n.created_at DESC;

-- name: GetBabyName :one
SELECT n.*, COALESCE(array_agg(l.member_id ORDER BY l.created_at) FILTER (WHERE l.member_id IS NOT NULL), '{}')::uuid[] AS liked_by
FROM baby_names n
LEFT JOIN baby_name_likes l ON l.name_id = n.id AND l.family_id = n.family_id
WHERE n.family_id = @family_id AND n.id = @id
GROUP BY n.id;

-- name: CreateBabyName :one
INSERT INTO baby_names (family_id, name, added_by, created_at)
VALUES (@family_id, @name, @added_by, @created_at)
ON CONFLICT (family_id, lower(name)) DO NOTHING
RETURNING *;

-- name: LikeBabyName :exec
INSERT INTO baby_name_likes (name_id, family_id, member_id, created_at)
SELECT n.id, n.family_id, @member_id, @created_at FROM baby_names n
WHERE n.id = @name_id AND n.family_id = @family_id
ON CONFLICT (name_id, member_id) DO NOTHING;

-- name: UnlikeBabyName :exec
DELETE FROM baby_name_likes WHERE name_id = @name_id AND family_id = @family_id AND member_id = @member_id;

-- name: ListNameSwipes :many
-- Every swipe of the family, both parents. Callers filter with
-- together.Visible before showing one parent's answer to the other.
SELECT * FROM baby_name_swipes WHERE family_id = @family_id ORDER BY swiped_at DESC;

-- name: UpsertNameSwipe :exec
INSERT INTO baby_name_swipes (family_id, member_id, name, verdict, swiped_at)
VALUES (@family_id, @member_id, @name, @verdict, @swiped_at)
ON CONFLICT (family_id, member_id, lower(name)) DO UPDATE SET verdict = EXCLUDED.verdict, swiped_at = EXCLUDED.swiped_at;

-- name: DeleteNameSwipe :exec
DELETE FROM baby_name_swipes WHERE family_id = @family_id AND member_id = @member_id AND lower(name) = lower(@name);

-- name: GetBabyNameByName :one
SELECT * FROM baby_names WHERE family_id = @family_id AND lower(name) = lower(@name);

-- name: GetNamesQuest :one
SELECT * FROM names_quests WHERE family_id = @family_id;

-- name: SetNamesQuestLists :exec
INSERT INTO names_quests (family_id, lists, updated_by, updated_at)
VALUES (@family_id, @lists, @updated_by, @updated_at)
ON CONFLICT (family_id) DO UPDATE SET lists = EXCLUDED.lists, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;

-- name: ListNameDuels :many
SELECT * FROM baby_name_duels WHERE family_id = @family_id ORDER BY judged_at;

-- name: UpsertNameDuel :exec
INSERT INTO baby_name_duels (family_id, member_id, low_id, high_id, winner_id, judged_at)
VALUES (@family_id, @member_id, @low_id, @high_id, @winner_id, @judged_at)
ON CONFLICT (member_id, low_id, high_id) DO UPDATE SET winner_id = EXCLUDED.winner_id, judged_at = EXCLUDED.judged_at;
