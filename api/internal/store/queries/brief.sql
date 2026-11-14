-- Mirrors access.CanParentRead: a brief belongs to its author alone, so only the
-- viewer's own briefs are read whatever their visibility. The newest one is the
-- current brief unless its session is over (the caller decides).
-- name: GetLatestSessionBriefVisibleToParent :one
SELECT b.*, s.starts_at AS session_starts_at
FROM session_briefs b
LEFT JOIN psychologist_bookings k ON k.id = b.booking_id AND k.family_id = b.family_id
LEFT JOIN psychologist_slots s ON s.id = k.slot_id
WHERE b.family_id = @family_id AND b.owner_member_id = @viewer_id
ORDER BY b.created_at DESC
LIMIT 1
FOR UPDATE OF b;

-- name: CreateSessionBrief :one
INSERT INTO session_briefs (family_id, owner_member_id, visibility, booking_id, include_mood, entry_ids,
                            note_sealed, status, send_at, sent_at, snapshot_sealed, created_at, updated_at)
VALUES (@family_id, @owner_member_id, 'private', @booking_id, @include_mood, @entry_ids,
        @note_sealed, @status, @send_at, @sent_at, @snapshot_sealed, @now, @now)
RETURNING *;

-- name: UpdateOwnSessionBrief :one
UPDATE session_briefs
SET booking_id = @booking_id, include_mood = @include_mood, entry_ids = @entry_ids, note_sealed = @note_sealed,
    status = @status, send_at = @send_at, sent_at = @sent_at, snapshot_sealed = @snapshot_sealed, updated_at = @now
WHERE id = @id AND family_id = @family_id AND owner_member_id = @owner_member_id
RETURNING *;

-- A brief waiting to be sent for a booking that moves keeps its day-before send time.
-- name: MoveScheduledSessionBriefs :exec
UPDATE session_briefs SET send_at = @send_at, updated_at = @now
WHERE family_id = @family_id AND owner_member_id = @owner_member_id AND booking_id = @booking_id
  AND status = 'scheduled' AND send_at > @now;

-- Nothing is sent for a cancelled session: a scheduled brief goes back to a draft.
-- name: UnscheduleSessionBriefs :exec
UPDATE session_briefs SET status = 'draft', send_at = NULL, snapshot_sealed = NULL, updated_at = @now
WHERE family_id = @family_id AND owner_member_id = @owner_member_id AND booking_id = @booking_id
  AND status = 'scheduled' AND send_at > @now;

-- A deleted journal entry leaves every brief that is not sent yet; a scheduled
-- one that carried it goes back to a draft.
-- name: DropEntryFromSessionBriefs :exec
UPDATE session_briefs
SET entry_ids = array_remove(entry_ids, @entry_id::uuid),
    status = CASE WHEN status = 'scheduled' AND @entry_id::uuid = ANY(entry_ids) THEN 'draft' ELSE status END,
    send_at = CASE WHEN status = 'scheduled' AND @entry_id::uuid = ANY(entry_ids) THEN NULL ELSE send_at END,
    snapshot_sealed = CASE WHEN status = 'scheduled' AND @entry_id::uuid = ANY(entry_ids) THEN NULL ELSE snapshot_sealed END,
    updated_at = @now
WHERE family_id = @family_id AND owner_member_id = @owner_member_id AND status <> 'sent'
  AND (status <> 'scheduled' OR send_at > @now);

-- A topic left the agenda (its entry was deleted): a scheduled brief that is
-- not out yet goes back to a draft, so it never sends what the parent removed.
-- name: UnscheduleOwnPendingSessionBriefs :exec
UPDATE session_briefs SET status = 'draft', send_at = NULL, snapshot_sealed = NULL, updated_at = @now
WHERE family_id = @family_id AND owner_member_id = @owner_member_id AND status = 'scheduled' AND send_at > @now;
