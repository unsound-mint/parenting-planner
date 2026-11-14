# Agent guide

Read this before any work in this repo. It is loaded in every session, so keep it short.

## Context

Hackathon project for Business Cup 2.0 (Zimran). Deadline 12:00, Nov 15 2026. Rules and scoring: `docs/requirements.md`, organizer answers in `docs/faq.md`. What we build and what we do not: `docs/product.md`. Evidence and guideline sources: `docs/research.md`. The demo script in `docs/demo-script.md` is the acceptance test for the MVP.

Before starting an issue, read `docs/product.md`. If the issue conflicts with it, say so instead of building it.

## Roles and ownership

| Person | Role | Owns |
| --- | --- | --- |
| Denis | frontend | `web/` |
| Sofia | backend | `api/` (except `openapi.yaml`), `deploy/` |
| Dayana | product | `docs/product.md`, `docs/demo-script.md`, rule wording in `api/internal/rules/`, GitHub issues |
| Denis and Sofia | both | `api/openapi.yaml`, the contract: changes need both to agree |

Touching another owner's area is fine for small changes; mention it in the PR so they see it.

## Rules that judges check

- The live site must work with no sign-up or login. Visitors pick a demo family and get their own seeded copy (httpOnly cookie `pp_session`). Do not add auth.
- Core value must be real: plans, rule results, check-ins, diary sharing and bookings are computed from database state, never hardcoded UI.
- Health guidance: every rule carries a source and a checked date; the AI never diagnoses; crisis and urgent-symptom paths are fixed screens, never generated text. Diaries are private to their author unless shared per entry.
- The repo is public. Never commit secrets, `.env*`, `private/` or real personal data. Demo data is synthetic.

## Code conventions

Architecture and commands: `docs/architecture.md`. Before changing `api/`, read `api/AGENTS.md`: it fixes naming, errors, access, audit and tests, and lists the files to copy. The essentials:

- `api/openapi.yaml` is the only contract between web and api. To add or change an endpoint, edit it first, run `make gen`, then implement both sides. Never edit `*.gen.go` or `*.gen.ts`; CI fails if generated code is stale.
- The web app never touches the database and never hand-writes API types; it uses the generated client (`web/src/lib/api/`).
- Every family-scoped query filters by the session's family id. Reads of sensitive records (labs, diary, mood, session notes) go through the visibility rules in `api/internal/access`; the SQL filter must mirror the Go function and say so in a comment.
- Schema changes are new goose migrations in `api/internal/store/migrations/`; never edit an applied one. Migrations run on API start.
- Health logic lives in `api/internal/rules` as pure functions with tests. Each rule cites a source you actually opened and its checked date.
- Next.js has Cache Components on: anything that calls the API renders inside `<Suspense>`; never `"use cache"` per-family data.
- Before a PR: `make check`.

## Git workflow

- `main` deploys to production on every push. Keep it working.
- One issue, one short-lived branch (`<issue-number>-short-name`), one PR that says `Closes #N`. Merge as soon as CI is green; review is optional during the hackathon except for schema or deploy changes.
- Small PRs merged often beat a big one at 3 am.
- No AI attribution in commits, PRs or code comments.
