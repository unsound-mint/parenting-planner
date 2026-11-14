-- Friend families. Besides analytics, the only reads across families
-- (docs/architecture.md). Every read starts from the viewer's family and
-- reaches another family only through an ACCEPTED friend_connections row;
-- what it may return is the other family's parents' first names, their friend
-- updates and reactions. store/conventions_test.go fails if this file names
-- any other table.

-- name: CreateFriendFamily :one
INSERT INTO families (template, stage, due_date, friend_of) VALUES ('friend', @stage, @due_date, @friend_of) RETURNING id;

-- name: GetFriendCode :one
SELECT * FROM friend_codes WHERE family_id = @family_id AND expires_at > @now;

-- name: UpsertFriendCode :one
INSERT INTO friend_codes (family_id, code, created_by, created_at, expires_at)
VALUES (@family_id, @code, @created_by, @now, @expires_at)
ON CONFLICT (family_id) DO UPDATE SET code = EXCLUDED.code, created_by = EXCLUDED.created_by, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at
RETURNING *;

-- name: FindFriendCode :one
SELECT family_id FROM friend_codes WHERE code = @code AND expires_at > @now;

-- name: CreateFriendConnection :one
INSERT INTO friend_connections (requester_family, addressee_family, requested_by, created_at, accepted_at)
VALUES (@requester_family, @addressee_family, @requested_by, @now, sqlc.narg(accepted_at))
ON CONFLICT DO NOTHING
RETURNING *;

-- The viewer's connections, accepted and pending, with the other family's id.
-- name: ListFriendConnections :many
SELECT c.id, c.created_at, c.accepted_at,
       (c.requester_family = @family_id)::bool AS outgoing,
       CASE WHEN c.requester_family = @family_id THEN c.addressee_family ELSE c.requester_family END::uuid AS other_family
FROM friend_connections c
WHERE c.requester_family = @family_id OR c.addressee_family = @family_id
ORDER BY c.accepted_at IS NULL DESC, c.created_at DESC;

-- name: GetFriendConnection :one
SELECT c.id, c.created_at, c.accepted_at,
       (c.requester_family = @family_id)::bool AS outgoing,
       CASE WHEN c.requester_family = @family_id THEN c.addressee_family ELSE c.requester_family END::uuid AS other_family
FROM friend_connections c
WHERE c.id = @id AND (c.requester_family = @family_id OR c.addressee_family = @family_id);

-- Only the side that was asked can accept.
-- name: AcceptFriendConnection :one
UPDATE friend_connections SET accepted_at = @now
WHERE id = @id AND addressee_family = @family_id AND accepted_at IS NULL
RETURNING id;

-- name: DeleteFriendConnection :one
DELETE FROM friend_connections
WHERE id = @id AND (requester_family = @family_id OR addressee_family = @family_id)
RETURNING CASE WHEN requester_family = @family_id THEN addressee_family ELSE requester_family END::uuid AS other_family;

-- After a disconnect neither family keeps the other's reactions on its updates.
-- name: DeleteReactionsBetween :exec
DELETE FROM friend_reactions r USING friend_updates u
WHERE r.update_id = u.id
  AND ((u.family_id = @a AND r.family_id = @b) OR (u.family_id = @b AND r.family_id = @a));

-- First names of the parents of families the viewer is connected to or has a
-- pending request with (a request shows who it is from). Never caregivers.
-- name: ListFriendFamilyParents :many
SELECT m.family_id, m.display_name
FROM members m
WHERE m.role IN ('mother','partner')
  AND m.family_id IN (
    SELECT CASE WHEN c.requester_family = @family_id THEN c.addressee_family ELSE c.requester_family END
    FROM friend_connections c
    WHERE c.requester_family = @family_id OR c.addressee_family = @family_id)
ORDER BY m.family_id, m.role;

-- name: CreateFriendUpdate :one
INSERT INTO friend_updates (family_id, author_member_id, kind, headline, body, created_at)
VALUES (@family_id, @author_member_id, @kind, sqlc.narg(headline), @body, @created_at)
RETURNING *;

-- The viewer's own updates and those of ACCEPTED friends, newest first.
-- name: ListFriendUpdates :many
SELECT u.id, u.family_id, u.author_member_id, u.kind, u.headline, u.body, u.created_at, m.display_name AS author_name
FROM friend_updates u
JOIN members m ON m.id = u.author_member_id
WHERE u.created_at >= @since
  AND (u.family_id = @family_id OR u.family_id IN (
    SELECT CASE WHEN c.requester_family = @family_id THEN c.addressee_family ELSE c.requester_family END
    FROM friend_connections c
    WHERE c.accepted_at IS NOT NULL AND (c.requester_family = @family_id OR c.addressee_family = @family_id)))
ORDER BY u.created_at DESC
LIMIT 100;

-- One update, if the viewer may see it (same rule as ListFriendUpdates).
-- name: GetVisibleFriendUpdate :one
SELECT u.id, u.family_id, u.author_member_id, u.kind, u.headline, u.body, u.created_at, m.display_name AS author_name
FROM friend_updates u
JOIN members m ON m.id = u.author_member_id
WHERE u.id = @id
  AND (u.family_id = @family_id OR u.family_id IN (
    SELECT CASE WHEN c.requester_family = @family_id THEN c.addressee_family ELSE c.requester_family END
    FROM friend_connections c
    WHERE c.accepted_at IS NOT NULL AND (c.requester_family = @family_id OR c.addressee_family = @family_id)));

-- Only its author removes an update.
-- name: DeleteFriendUpdate :execrows
DELETE FROM friend_updates WHERE id = @id AND family_id = @family_id AND author_member_id = @author_member_id;

-- name: UpsertFriendReaction :exec
INSERT INTO friend_reactions (update_id, member_id, family_id, reaction, created_at)
VALUES (@update_id, @member_id, @family_id, @reaction, @created_at)
ON CONFLICT (update_id, member_id) DO UPDATE SET reaction = EXCLUDED.reaction, created_at = EXCLUDED.created_at;

-- name: DeleteFriendReaction :exec
DELETE FROM friend_reactions WHERE update_id = @update_id AND member_id = @member_id;

-- Reactions the viewer may see on these updates: every reaction on the
-- viewer's own family's updates, and on a friend's update only the viewer's
-- family's own. So a friend never learns who else reacted, or that other
-- friends exist.
-- name: ListVisibleFriendReactions :many
SELECT r.update_id, r.member_id, r.family_id, r.reaction, r.created_at, m.display_name
FROM friend_reactions r
JOIN friend_updates u ON u.id = r.update_id
JOIN members m ON m.id = r.member_id
WHERE r.update_id = ANY(@update_ids::uuid[])
  AND (u.family_id = @family_id OR r.family_id = @family_id)
ORDER BY r.created_at;
