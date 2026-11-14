-- name: CreateStory :one
INSERT INTO stories (family_id, owner_member_id, visibility, child_id, child_name, age_months, theme, signed_as, title, memories, pages, generated_by, created_at)
VALUES (@family_id, @owner_member_id, @visibility, @child_id, @child_name, @age_months, @theme, @signed_as, @title, @memories, @pages, @generated_by, @created_at)
RETURNING *;

-- Mirrors access.CanParentRead: own stories, plus the other parent's stories shared with the partner.
-- name: ListStoriesVisibleToParent :many
SELECT * FROM stories
WHERE family_id = @family_id
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'))
ORDER BY created_at DESC
LIMIT 50;

-- Mirrors access.CanParentRead: one story, own or shared with the partner.
-- name: GetStoryVisibleToParent :one
SELECT * FROM stories
WHERE id = @id AND family_id = @family_id
  AND (owner_member_id = @viewer_id OR visibility IN ('partner', 'family'));

-- Mirrors access.CanParentRead for a change: only the author, so the other parent's
-- shared story cannot be changed.
-- name: UpdateOwnStoryVisibleToParent :one
UPDATE stories SET visibility = @visibility
WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id
RETURNING *;

-- Mirrors access.CanParentRead for a change: only the author.
-- name: DeleteOwnStoryVisibleToParent :execrows
DELETE FROM stories WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id;
