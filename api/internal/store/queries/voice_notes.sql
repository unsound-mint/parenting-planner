-- name: CreateVoiceNote :one
INSERT INTO voice_notes (family_id, uploader_member_id, content_type, size_bytes, duration_seconds, audio, created_at)
VALUES (@family_id, @uploader_member_id, @content_type, @size_bytes, @duration_seconds, @audio, @created_at)
RETURNING id, family_id, uploader_member_id, handoff_id, content_type, size_bytes, duration_seconds, created_at;

-- Only the uploader may play a note for now. When handoffs land (#370), whoever
-- may see the attached handoff may play it too.
-- name: GetVoiceNoteVisibleToMember :one
SELECT * FROM voice_notes
WHERE id = @id AND family_id = @family_id AND uploader_member_id = @viewer_id;

-- A note that was never attached to a handoff is dropped after a day.
-- name: DeleteStaleVoiceNotes :execrows
DELETE FROM voice_notes
WHERE family_id = @family_id AND handoff_id IS NULL AND created_at < @before;
