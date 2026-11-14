-- name: CreateFertilityEntry :one
INSERT INTO fertility_entries (family_id, owner_member_id, visibility, kind, entry_date, code, temp_c, note_sealed)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;

-- A day has one flow, one temperature and one ovulation test result: a new one replaces
-- the old. Only the author's own entries are touched.
-- name: DeleteOwnFertilityDayKind :exec
DELETE FROM fertility_entries
WHERE family_id = @family_id AND owner_member_id = @owner_id AND kind = @kind AND entry_date = @entry_date
  AND (@code::text = '' OR code = @code::text);

-- Mirrors access.CanParentRead: own entries, plus entries the other parent shared with the
-- partner. There is no family level, so a caregiver has no query here at all.
-- name: ListFertilityEntriesVisibleToParent :many
SELECT * FROM fertility_entries
WHERE family_id = @family_id AND entry_date >= @since
  AND (owner_member_id = @viewer_id OR visibility = 'partner')
ORDER BY entry_date DESC, created_at DESC;

-- Mirrors access.CanParentRead for a change: only the author, so another parent's shared
-- entry cannot be found and its existence is not revealed. Locks the row.
-- name: GetOwnFertilityEntryVisibleToParent :one
SELECT * FROM fertility_entries WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id FOR UPDATE;

-- Mirrors access.CanParentRead for a change: only the author.
-- name: UpdateOwnFertilityEntryVisibleToParent :one
UPDATE fertility_entries SET visibility = @visibility
WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id RETURNING *;

-- Mirrors access.CanParentRead for a change: only the author.
-- name: DeleteOwnFertilityEntryVisibleToParent :execrows
DELETE FROM fertility_entries WHERE id = @id AND family_id = @family_id AND owner_member_id = @viewer_id;

-- Mirrors access.CanParentRead: period days of the viewer's own cycle only. A prediction is
-- about the author's body, so a partner's shared entries never feed it.
-- name: ListOwnPeriodDaysVisibleToParent :many
SELECT entry_date FROM fertility_entries
WHERE family_id = @family_id AND owner_member_id = @viewer_id AND kind = 'period' AND code <> 'spotting' AND entry_date >= @since
ORDER BY entry_date;

-- name: UpsertPreconceptionTick :one
INSERT INTO preconception_ticks (family_id, owner_member_id, visibility, item_key, done_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (owner_member_id, item_key) DO UPDATE SET visibility = EXCLUDED.visibility
RETURNING *;

-- name: DeleteOwnPreconceptionTick :exec
DELETE FROM preconception_ticks WHERE family_id = @family_id AND owner_member_id = @owner_id AND item_key = @item_key;

-- Mirrors access.CanParentRead: own ticks, plus ticks the other parent shared with the partner.
-- name: ListPreconceptionTicksVisibleToParent :many
SELECT * FROM preconception_ticks
WHERE family_id = @family_id AND (owner_member_id = @viewer_id OR visibility = 'partner');

-- Mirrors access.CanParentRead: journey settings are private to their owner, so only the
-- viewer's own row is read.
-- name: GetJourneySettingsVisibleToParent :one
SELECT * FROM journey_settings WHERE family_id = @family_id AND owner_member_id = @viewer_id;

-- name: UpsertJourneySettings :one
INSERT INTO journey_settings (family_id, owner_member_id, hide_baby_content, fertility_treatment, previous_loss, trying_since, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (owner_member_id) DO UPDATE SET hide_baby_content = EXCLUDED.hide_baby_content,
  fertility_treatment = EXCLUDED.fertility_treatment, previous_loss = EXCLUDED.previous_loss,
  trying_since = EXCLUDED.trying_since, updated_at = EXCLUDED.updated_at
RETURNING *;
