-- ON CONFLICT only fires for rows with on_day set (computed notifications);
-- event notifications leave it NULL and are always inserted.
-- name: CreateNotification :execrows
INSERT INTO notifications (family_id, recipient_member_id, kind, entity_id, actor_member_id, title, on_day, created_at)
VALUES (@family_id, @recipient_member_id, @kind, @entity_id, @actor_member_id, @title, @on_day, @created_at)
ON CONFLICT DO NOTHING;

-- Only the recipient's own notifications.
-- name: ListNotificationsForRecipient :many
SELECT * FROM notifications
WHERE family_id = @family_id
  AND recipient_member_id = @recipient_id
  AND created_at >= @since
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- name: CountUnreadNotifications :one
SELECT count(*) FROM notifications
WHERE family_id = @family_id
  AND recipient_member_id = @recipient_id
  AND created_at >= @since
  AND read_at IS NULL;

-- Ids that are not the recipient's are ignored.
-- name: MarkNotificationsRead :exec
UPDATE notifications SET read_at = @read_at
WHERE family_id = @family_id
  AND recipient_member_id = @recipient_id
  AND read_at IS NULL
  AND id = ANY(@ids::uuid[]);

-- name: MarkAllNotificationsRead :exec
UPDATE notifications SET read_at = @read_at
WHERE family_id = @family_id
  AND recipient_member_id = @recipient_id
  AND read_at IS NULL;

-- The family's parents: the people who receive notifications about a child's
-- records. Caregivers never do.
-- name: ListFamilyParents :many
SELECT * FROM members
WHERE family_id = @family_id AND role IN ('mother', 'partner')
ORDER BY role;
