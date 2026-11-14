-- name: CreateDiaryEntry :one
INSERT INTO diary_entries (family_id, owner_member_id, visibility, written_at, body_sealed, agenda_topic)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- Mirrors access.CanParentRead: own entries, plus entries shared with the partner or the family.
-- name: ListDiaryEntriesVisibleToParent :many
SELECT * FROM diary_entries
WHERE family_id = @family_id AND written_at >= @since
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY written_at DESC, created_at DESC;

-- Mirrors access.CanParentRead for a change: only the author, so another parent's shared
-- entry cannot be found (and does not reveal that it exists). Locks the row.
-- name: GetOwnDiaryEntryVisibleToParent :one
SELECT * FROM diary_entries WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id FOR UPDATE;

-- Mirrors access.CanParentRead for a change: only the author.
-- name: UpdateOwnDiaryEntryVisibleToParent :one
UPDATE diary_entries SET visibility = @visibility, agenda_topic = @agenda_topic
WHERE id = @id AND owner_member_id = @viewer_id RETURNING *;

-- Mirrors access.CanParentRead: the agenda topics belong to their author alone, so
-- only the viewer's own entries are read, whatever their visibility.
-- name: ListDiaryAgendaTopicsVisibleToParent :many
SELECT id, written_at, agenda_topic FROM diary_entries
WHERE family_id = @family_id AND owner_member_id = @viewer_id AND agenda_topic IS NOT NULL AND written_at >= @since
ORDER BY written_at;
