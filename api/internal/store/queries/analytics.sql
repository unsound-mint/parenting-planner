-- Analytics is the one deliberate read across families (see internal/analytics).
-- These queries return counts only: no ids, names or text, and they never
-- touch a health table.

-- name: CountFamiliesStartedByDay :many
-- One row per UTC day from from_day to to_day, zeros included.
SELECT d::date AS day,
       count(f.id)::int AS started,
       (count(f.id) FILTER (WHERE f.template = 'custom'))::int AS custom_started
FROM generate_series(@from_day::date, @to_day::date, interval '1 day') AS d
LEFT JOIN families f ON (f.created_at AT TIME ZONE 'UTC')::date = d::date AND f.friend_of IS NULL
GROUP BY d
ORDER BY d;

-- name: CountFamiliesStartedByTemplate :many
SELECT template, count(*)::int AS families
FROM families
-- A demo's synthetic friend families are not visitors.
WHERE friend_of IS NULL AND (created_at AT TIME ZONE 'UTC')::date BETWEEN @from_day::date AND @to_day::date
GROUP BY template;
