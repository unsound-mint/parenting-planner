-- Our story (GET /members/{memberId}/story): read-only aggregations of rows the
-- family already has. Nothing here writes.

-- Mirrors access.CanParentRead, narrowed for the shared book: only visits with
-- visibility family, never a private one, not even the viewer's own, so both
-- parents read the same story. Past visits only.
-- name: ListStoryAppointmentsVisibleToParent :many
SELECT e.id, e.owner_member_id, e.title, e.starts_at,
       COALESCE((SELECT array_agg(a.member_id ORDER BY a.member_id) FROM calendar_event_attendees a WHERE a.event_id = e.id), '{}')::uuid[] AS attendee_ids
FROM calendar_events e
WHERE e.family_id = @family_id AND e.kind = 'appointment' AND e.visibility = 'family' AND e.starts_at <= @now
ORDER BY e.starts_at, e.id;

-- Mirrors access.CanParentRead, narrowed for the shared book: only entries
-- their author shared with the partner or the family. A private entry never
-- appears, not even to its author. Written before now only.
-- A few lines per month (firsts before the rest), so a family that has written
-- for years gets every month in its book instead of only its first 60 entries.
-- name: ListStoryDiaryEntriesVisibleToParent :many
SELECT e.* FROM diary_entries e
WHERE e.family_id = @family_id AND e.visibility IN ('partner', 'family') AND e.id IN (
  SELECT picked.id FROM (
    SELECT d.id, row_number() OVER (PARTITION BY date_trunc('month', d.written_at) ORDER BY d.is_first DESC, d.written_at, d.id) AS n
    FROM diary_entries d
    WHERE d.family_id = @family_id AND d.visibility IN ('partner', 'family') AND d.written_at <= @now
  ) picked
  WHERE picked.n <= 4
)
ORDER BY e.written_at, e.id;

-- Care log totals per person who logged, with the first entry.
-- name: StoryCareLogByAuthor :many
SELECT author_member_id, count(*)::int AS entries, min(started_at)::timestamptz AS first_at
FROM care_log_entries
WHERE family_id = @family_id AND started_at <= @now
GROUP BY author_member_id
ORDER BY first_at, author_member_id;

-- name: ListStoryHandoffs :many
SELECT id, from_member_id, to_member_id, accepted_at::timestamptz AS accepted_at
FROM handoffs
WHERE family_id = @family_id AND status = 'accepted' AND accepted_at <= @now::timestamptz
ORDER BY accepted_at, id;

-- Doses given to the family's children, one row per child and day.
-- name: ListStoryChildVaccineDays :many
SELECT subject_child_id::uuid AS child_id, given_on, array_agg(vaccine ORDER BY vaccine)::text[] AS vaccines
FROM immunizations
WHERE family_id = @family_id AND subject_child_id IS NOT NULL AND given_on <= @today
GROUP BY subject_child_id, given_on
ORDER BY given_on, subject_child_id;
