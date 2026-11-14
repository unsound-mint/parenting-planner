-- name: GetCalendarFeed :one
SELECT * FROM calendar_feeds WHERE family_id = $1 AND member_id = $2;

-- name: SetCalendarFeed :one
INSERT INTO calendar_feeds (family_id, member_id, token_hash, scope, created_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (family_id, member_id) DO UPDATE SET
    token_hash = EXCLUDED.token_hash, scope = EXCLUDED.scope,
    created_at = EXCLUDED.created_at, last_fetched_at = NULL
RETURNING *;

-- name: DeleteCalendarFeed :exec
DELETE FROM calendar_feeds WHERE family_id = $1 AND member_id = $2;

-- The unique hash is the capability. Resolve its family and recheck the
-- member's current schedule permission on each external sync.
-- name: FindCalendarFeed :one
SELECT cf.family_id, cf.member_id, cf.scope, f.demo_offset_days, m.role
FROM calendar_feeds cf
JOIN families f ON f.id = cf.family_id
JOIN members m ON m.id = cf.member_id AND m.family_id = cf.family_id
WHERE cf.token_hash = $1 AND m.revoked_at IS NULL
  AND (m.role IN ('mother', 'partner') OR
       (cf.scope = 'mine' AND 'schedule' = ANY(m.permissions)));

-- name: MarkCalendarFeedFetched :execrows
UPDATE calendar_feeds SET last_fetched_at = $4
WHERE calendar_feeds.family_id = $1 AND calendar_feeds.member_id = $2 AND calendar_feeds.token_hash = $3
  AND EXISTS (SELECT 1 FROM members m WHERE m.id = $2 AND m.family_id = $1
              AND m.revoked_at IS NULL AND (m.role IN ('mother', 'partner')
                   OR (calendar_feeds.scope = 'mine' AND 'schedule' = ANY(m.permissions))));
