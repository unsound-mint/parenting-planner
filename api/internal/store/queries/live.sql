-- name: InsertLiveEvent :one
INSERT INTO live_events (family_id, kind, entity_id, actor_member_id, audience, needs_permission, at)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;

-- name: PruneLiveEvents :exec
DELETE FROM live_events WHERE at < $1;

-- name: MaxLiveEventID :one
SELECT COALESCE(max(id), 0)::bigint FROM live_events WHERE family_id = $1;

-- What one person may be told about: the event is for the whole family or lists them,
-- and a caregiver needs the event's permission (parents always pass).
-- name: ListLiveEventsSince :many
SELECT id, kind, entity_id, actor_member_id, at FROM live_events
WHERE family_id = @family_id AND id > @after_id
  AND (audience IS NULL OR @member_id::uuid = ANY(audience))
  AND (needs_permission IS NULL OR @is_parent::boolean OR needs_permission = ANY(@permissions::text[]))
ORDER BY id
LIMIT 100;
