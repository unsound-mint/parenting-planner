-- name: CreateVoiceNote :one
INSERT INTO voice_notes (family_id, uploader_member_id, content_type, size_bytes, duration_seconds, audio, created_at)
VALUES (@family_id, @uploader_member_id, @content_type, @size_bytes, @duration_seconds, @audio, @created_at)
RETURNING id, family_id, uploader_member_id, handoff_id, content_type, size_bytes, duration_seconds, created_at;

-- The uploader may play a note. Once it is attached to a handoff, whoever may see
-- that handoff may too, mirroring listHandoffs: a parent sees every handoff of the
-- family, a caregiver only handoffs to or from them (@sees_all_handoffs is false).
-- name: GetVoiceNoteVisibleToMember :one
SELECT * FROM voice_notes v
WHERE v.id = @id AND v.family_id = @family_id
  AND (v.uploader_member_id = @viewer_id
       OR (v.handoff_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM handoffs h
            WHERE h.id = v.handoff_id AND h.family_id = v.family_id
              AND (@sees_all_handoffs::bool OR h.from_member_id = @viewer_id OR h.to_member_id = @viewer_id))));

-- A note that was never attached to a handoff is dropped after a day.
-- name: DeleteStaleVoiceNotes :execrows
DELETE FROM voice_notes
WHERE family_id = @family_id AND handoff_id IS NULL AND created_at < @before;
