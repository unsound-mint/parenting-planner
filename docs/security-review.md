# Security review, load test and restore drill (#134)

Review of `api/` on `main` at 131dd4d, 2026-11-14. It is sized for a demo: a public site with no login, synthetic families, one API process behind Caddy. File:line references point to this branch, where the fixes live.

**Result: no Critical findings are open.** Eight issues were fixed in this PR, and each has a regression test in `api/internal/httpapi/security_test.go` or `limits_internal_test.go`. The rest are listed with a suggested fix.

Severity scale: **Critical** (another family's data can be read or changed, or a secret leaks), **High** (one visitor can take the public demo down or run up real costs), **Medium** (abuse that needs effort, or a missing control around sensitive data), **Low** (defence in depth), **Info** (checked and fine).

## Findings

| # | Area | Finding | Severity | Status |
| --- | --- | --- | --- | --- |
| 1 | Demo sessions | `POST /demo/sessions` and `/demo/custom-sessions` had no limit. Each call seeds a whole family (about 4 members, check-ins, passport, offers, audit rows), and families are never deleted, so a loop could fill the disk. | High | **Fixed.** Per-address limit of 30 per 10 minutes, then 429 `rate_limited` with `Retry-After` (`internal/httpapi/limits.go:122`). In memory, standard library only. The limit is generous because judges on one venue Wi-Fi share an address. |
| 2 | Client address | Behind Caddy, `RemoteAddr` is the proxy. | — | **Fixed with #1.** `clientIP` (`limits.go:99`) trusts the rightmost `X-Forwarded-For` only when the peer is loopback or private (Caddy, the Docker bridge). Otherwise it uses the peer, so a direct client cannot forge the header. |
| 3 | Claude API cost | `GET /members/{id}/weekly-plan` called Claude on every request (`internal/httpapi/plan.go`), so a script could spend the API budget. | High | **Fixed.** At most 20 Claude calls per family per hour. After that the rule-based fallback is shown (`plan.go:106`). No contract change. |
| 4 | Request size | Only voice notes and the Stripe webhook capped the body. The OpenAPI validator reads any body into memory first. | Medium | **Fixed.** Every body is capped at 2 MiB (`capBody`, `limits.go:137`): a declared length over the cap gets 413, and a streamed one is cut off with 400. The largest legitimate body, a portrait, is 1.5 MB. |
| 5 | Voice notes | Each note was capped at 1 MB, but there was no cap on the number of notes. A loop of uploads that were never attached kept 1 MB each for 24 hours. | Medium | **Fixed.** Each person keeps at most 5 unattached notes; the oldest are deleted first (`internal/carelog/voice_notes.go:27`, query `DeleteExcessUnattachedVoiceNotes`). |
| 6 | Demo clock | `demo_offset_days` had no upper bound (`SkipFamilyDemoClock`), and every skip copies a week of mood check-ins. | Low | **Fixed.** The clock stops at 728 days (`demo.MaxOffsetDays`, `internal/demo/demo.go:100`). A skip past the bound returns 200 and changes nothing. |
| 7 | IDs from bodies | `createHandoff` stored the body's `shiftId` unchecked, and the column has no foreign key. Any UUID was stored and echoed back. | Low | **Fixed.** The shift must belong to the family, otherwise 409 (`internal/carelog/carelog.go:262`). |
| 8 | Audit | `calendar.ListForCaregiver` read parents' `family` events for a grandparent or nanny without an audit row; the parent path audits. | Medium | **Fixed.** The read and its `access.Audit` now run in one transaction (`internal/calendar/calendar.go:318`). |
| 9 | Security headers | The API set no security headers. | Low | **Fixed.** `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `CSP: default-src 'none'; frame-ancestors 'none'` and `Cache-Control: no-store` on every API response, error answers included (`limits.go:153`). A voice note still sets its own `private, max-age=3600`. HSTS and the page CSP belong in Caddy and Next.js (see 15). |
| 10 | Family scope | Every sqlc query was checked for a `family_id` filter (script over `internal/store/queries/*.sql`). The ones without one are safe. Global catalogues: `ListPsychologists`, `GetDemoPsychologist`, `ListProviders`, `ProviderExists`. Stripe events: `RecordStripeEvent`. The token is the credential for `GetInvitationByToken[ForUpdate]` (`invitations.sql:12,15`). `PruneLiveEvents` is a global cleanup. The rest update by primary key or owner after a family-scoped lookup in the same transaction: `AcceptHandoff` (`carelog.sql:44`, after `GetHandoffForUpdate`), `MarkInvitationRevoked/Accepted` (`invitations.sql:20,23`), `AddCalendarEventAttendee` (attendees are checked with `GetPerson`), and `UpdateOwnMoodScreeningVisibilityVisibleToParent` / `DeleteMoodScreeningDraft[s]` (`screening.sql:20,36,39`, by `owner_member_id` after `actingMember`). | Low | **Open (hardening).** Add `AND family_id = @family_id` to these queries anyway, so a later caller cannot forget the lookup. |
| 11 | IDs from bodies | Every ID read from a request body was traced to its domain function. Each is checked against the family: `toMemberId` (tasks, thanks, handoffs) through `GetPerson`; `childId` through `ChildInFamily` or the family's children; `appointmentId`, `bookingId` and `slotId` through family-scoped queries; `topicIds` against the current agenda; notification `ids` with `family_id` and recipient in SQL; `voiceNoteId` with family and uploader in SQL. The acting member always comes from the path through `actingMember` / `actingPerson`, never from the body. | Info | OK |
| 12 | Sensitive reads | `TestSensitiveReadsMirrorAccessRules` enforces the `...VisibleToParent` naming. A script listed every function that calls such a query without `Audit`. They are internal helpers whose callers audit (`care.buildAgenda`, `OwnBookings`, `appointments.visit`, `calendar.ownSessions`), seeding (`demo.go`), or #8. One exception: `plan.LoadFacts` (`internal/plan/plan.go:78`) reads labs, moods, screenings and session notes to build `GET /plan` (`internal/httpapi/plan.go:16`) without an audit row. Only the viewer's own visible data is used, and only rule items are returned. | Low | **Open.** Decide whether a derived read counts as a read. If it does, add one `access.Audit(..., "plan")` per `GET /plan`, as `weekly-plan` already does. |
| 13 | Cookie | `pp_session`: `HttpOnly`, `Secure` (unless `COOKIE_SECURE=false`, `cmd/server/main.go:58`), `SameSite=Lax`, `Path=/`, 30 days (`internal/httpapi/demo.go:30`). Only the sha256 is stored (`demo.HashToken`), and the token is 32 random bytes. Revoking a caregiver ends their session (`session.sql`, `GetSessionFamily`). | Info | OK. `TestSessionCookieFlags` added. |
| 14 | CSRF / CORS | The API sends no CORS headers, so other origins cannot read responses. Cross-site POSTs carry no cookie (`SameSite=Lax`), and JSON bodies are type-checked by the validator. However, sibling subdomains of `unsoundmint.com` are "same-site" and would send the cookie. | Low | **Open.** If another app ever runs on a sibling subdomain, check `Origin` on unsafe methods or use `SameSite=Strict`. |
| 15 | HSTS and page CSP | No `Strict-Transport-Security` and no CSP on the HTML pages. Both are served by Caddy and Next.js, not the API. | Low | **Open (deploy/ and web/, not touched here).** Add `header Strict-Transport-Security "max-age=31536000"` to the Caddy site block, and a CSP in `next.config.ts`. |
| 16 | Error bodies | 500s and panics return only `internal` / "something went wrong" (`server.go:92,118`), and `monitor.Scrub` cleans Sentry events. Validation errors (`server.go:76,87`) return kin-openapi's `err.Error()`, which can include a schema excerpt and the submitted value. There is no server internals or other family's data in it, and the response is JSON with `nosniff`. | Low | **Open.** Return only the first line of the validator message. |
| 17 | Claude key | `ai.Secret` redacts the key through fmt, slog and JSON (`internal/ai/config.go`). It is used only in `x-api-key` (`internal/aiplan/aiplan.go:183`). Upstream error bodies are never returned (`aiplan.go:186-191`), and the response is capped. `main.go` logs only `ai_plan=true/false`. The key is present only in the server environment. | Info | OK |
| 18 | Export | `GET /members/{id}/export` is restricted to parents (`actingMember`). It reads through the same `VisibleToParent` queries and audits each entity (`internal/account/account.go:80`). | Info | OK |
| 19 | Voice note playback | `GetVoiceNoteVisibleToMember` filters by family and by uploader or the handoff's parties. Playback is audited. The content type is allow-listed and re-formatted, and served with `nosniff`. | Info | OK |
| 20 | Live updates (SSE) | Each open `GET /members/{id}/live` stream polls the database every 500 ms (`internal/httpapi/live.go:17`), and the number of open streams is not capped. 1,000 idle tabs would mean about 2,000 queries/s. | Medium | **Open.** Cap streams per session (for example 3) and per address. Or use one poller per family that fans out to its streams. |
| 21 | Data growth | Families and sessions are never deleted. Sessions expire after 30 days, but their families stay. With #1 the growth rate is bounded, not the total. | Medium | **Open.** Add a daily `DELETE FROM families WHERE id IN (families whose newest session expired more than N days ago)`. The cascade removes everything else. |
| 22 | Server timeouts | `ReadHeaderTimeout` is 5 s (`main.go:69`). There is no `ReadTimeout` or `WriteTimeout`. A blanket `WriteTimeout` would cut the SSE stream. | Low | **Open.** Set `ReadTimeout: 30s` and `IdleTimeout: 120s`. For SSE, use `http.ResponseController` and keep `WriteTimeout` off. |
| 23 | Diary key | Without `DIARY_ENCRYPTION_KEY`, a random key is made on every start (`main.go:49`), and diary text written before a restart cannot be read. A database backup is useless for diary text without the key (see the drill). | Medium | **Open (deploy/).** Make sure the key is set in `deploy/.env`, and back it up separately from the dump. |
| 24 | Backups | Production has no dump job (`docs/data-model.md`). | Medium | **Open (deploy/).** Use the drill below as a nightly cron job on the server, with dumps kept for 7 days. Owner: Sofia. |

What the limits do not cover: they live in memory per process and reset on restart. Several API replicas would need a shared store. That does not apply today: there is one replica.

## Load test

`api/internal/httpapi/load_test.go` (`TestLoad`) uses only the standard library. It is skipped unless `LOAD_TEST=1`. It starts one API server on the test database, with the per-address limit off because every client is 127.0.0.1. It creates N demo families concurrently, rotating pregnancy, newborn and preschool, each with its own cookie jar. Then it sends `GET /members/{mother}/plan`, `/passport` and `/journey` for every family, R rounds each, from W goroutines.

```sh
LOAD_TEST=1 LOAD_SESSIONS=200 LOAD_ROUNDS=20 LOAD_WORKERS=50 \
TEST_DATABASE_URL=postgres://parenting:parenting@localhost:5433/parenting_134?sslmode=disable \
go test ./internal/httpapi -run '^TestLoad$' -v -count=1
```

Setup: a laptop with 32 cores, Postgres 17 in podman on the same machine, and the default `pgxpool` (MaxConns 32). Client and server ran in one process, so the client's CPU is included in the times.

N=200 sessions, R=20 rounds, W=50 concurrent, GOMAXPROCS=32:

| Endpoint | Requests | Errors | p50 | p95 | p99 | max |
| --- | --- | --- | --- | --- | --- | --- |
| POST /demo/sessions | 200 | 0 | 128.2 ms | 250.4 ms | 301.8 ms | 304.7 ms |
| GET /plan | 4000 | 0 | 12.5 ms | 15.6 ms | 30.1 ms | 41.5 ms |
| GET /passport | 4000 | 0 | 8.3 ms | 10.1 ms | 18.3 ms | 28.9 ms |
| GET /journey | 4000 | 0 | 12.3 ms | 14.8 ms | 28.6 ms | 48.1 ms |

Read throughput was about 4,300 requests/s, and 200 families were seeded in 0.56 s. The same run with GOMAXPROCS=2 (closer to a small server) gave p95 of 15.2 / 11.2 / 14.9 ms for plan / passport / journey, about 4,500 requests/s, and 0 errors. A smaller run (N=50, R=10, W=25) gave p95 of 7.4 / 6.8 / 5.8 ms.

Conclusion: at demo scale, the reads are bound by Postgres round trips, not CPU, and there is a lot of headroom. Creating a family is the slow call, at about 130 ms p50 under 50 concurrent requests, which is one more reason for the limit in #1.

## Restore drill

Run for real on 2026-11-14 against the local podman Postgres (`parenting-dev-pg`, Postgres 17.12). The source was this branch's test database `parenting_134` after the test suite and load test had filled it (64 MB, 1,081 families). Production and `deploy/` were not touched.

```sh
# 1. Dump (custom format: compressed, restorable in parallel)
time podman exec parenting-dev-pg pg_dump -U parenting -Fc -d parenting_134 -f /tmp/parenting_134.dump
#    -> 0.69 s, 5.5 MB dump file

# 2. Restore into a new, empty database
podman exec parenting-dev-pg createdb -U parenting parenting_134_restore
time podman exec parenting-dev-pg pg_restore -U parenting -d parenting_134_restore --no-owner --exit-on-error -j 4 /tmp/parenting_134.dump
#    -> 0.66 s, no errors

# 3. Verify: row counts and migration version match
for d in parenting_134 parenting_134_restore; do
  podman exec -i parenting-dev-pg psql -U parenting -d $d -At <<'SQL'
select 'families', count(*) from families union all select 'members', count(*) from members
union all select 'sessions', count(*) from sessions union all select 'mood_checkins', count(*) from mood_checkins
union all select 'diary_entries', count(*) from diary_entries union all select 'audit_log', count(*) from audit_log
union all select 'voice_notes', count(*) from voice_notes union all select 'goose', max(version_id) from goose_db_version;
SQL
done

# 4. The API runs on the restored database (migrations are a no-op, demos start)
TEST_DATABASE_URL=postgres://parenting:parenting@localhost:5433/parenting_134_restore?sslmode=disable \
  go test ./internal/httpapi -run 'TestEveryDemoTemplateStarts|TestDiary' -count=1   # ok

# 5. Clean up
podman exec parenting-dev-pg rm /tmp/parenting_134.dump
podman exec parenting-dev-pg dropdb -U parenting parenting_134_restore
```

| Table | Source | Restored |
| --- | --- | --- |
| families | 1081 | 1081 |
| members | 4334 | 4334 |
| sessions | 1091 | 1091 |
| mood_checkins | 5180 | 5180 |
| diary_entries | 42 | 42 |
| audit_log | 18149 | 18149 |
| voice_notes | 279 | 279 |
| goose version | 32 | 32 |

Dump plus restore takes under 1.5 s at this size, so the recovery time is dominated by noticing the problem and running the commands.

Lessons for production (owner: Sofia, `deploy/`):

- The same commands work against the compose service: `docker compose -f deploy/compose.yml exec -T postgres pg_dump -U parenting -Fc -d parenting > backup.dump`. Restore with `pg_restore` into a new database, then point `DATABASE_URL` at it.
- Diary text is encrypted with `DIARY_ENCRYPTION_KEY`. Without the same key a restored diary cannot be read, so keep the key backed up separately from the dumps (#23).
- Session cookies survive a restore, because only their hashes are stored. Restoring an older dump logs out visitors whose families are newer than the dump.
