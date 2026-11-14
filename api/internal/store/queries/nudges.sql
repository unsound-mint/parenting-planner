-- name: DismissNudge :exec
INSERT INTO nudge_dismissals (family_id, member_id, nudge_key, dismissed_at)
VALUES (@family_id, @member_id, @nudge_key, @dismissed_at)
ON CONFLICT (member_id, nudge_key) DO NOTHING;

-- name: IsNudgeDismissed :one
SELECT EXISTS (
  SELECT 1 FROM nudge_dismissals WHERE family_id = @family_id AND member_id = @member_id AND nudge_key = @nudge_key
);
