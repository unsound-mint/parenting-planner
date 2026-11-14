-- Only the acting member's own preferences: the agenda is private to its author.
-- name: ListAgendaTopicPrefs :many
SELECT * FROM agenda_topic_prefs WHERE family_id = $1 AND member_id = $2;

-- name: UpsertAgendaTopicPosition :exec
INSERT INTO agenda_topic_prefs (family_id, member_id, topic_id, position, removed_at)
VALUES ($1, $2, $3, $4, NULL)
ON CONFLICT (member_id, topic_id) DO UPDATE SET position = EXCLUDED.position, removed_at = NULL;

-- name: RemoveAgendaTopic :exec
INSERT INTO agenda_topic_prefs (family_id, member_id, topic_id, position, removed_at)
VALUES ($1, $2, $3, NULL, $4)
ON CONFLICT (member_id, topic_id) DO UPDATE SET position = NULL, removed_at = EXCLUDED.removed_at;
