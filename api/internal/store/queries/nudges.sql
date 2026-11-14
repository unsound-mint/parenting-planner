-- name: DismissNudge :exec
INSERT INTO nudge_dismissals (family_id, member_id, nudge_key, dismissed_at)
VALUES (@family_id, @member_id, @nudge_key, @dismissed_at)
ON CONFLICT (member_id, nudge_key) DO NOTHING;

-- name: ListNudgeDismissals :many
SELECT nudge_key FROM nudge_dismissals
WHERE family_id = @family_id AND member_id = @member_id AND dismissed_at >= @since
ORDER BY dismissed_at DESC;
