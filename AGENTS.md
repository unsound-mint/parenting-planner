# Agent guide

Read this before any work in this repo. It is loaded in every session, so keep it short.

## Context

Hackathon project for Business Cup 2.0 (Zimran). Deadline 12:00, Nov 15 2026. Rules and scoring: `docs/requirements.md`. What we build and what we do not: `docs/product.md`. Evidence and guideline sources: `docs/research.md`. The demo script in `docs/demo-script.md` is the acceptance test for the MVP.

Before starting an issue, read `docs/product.md`. If the issue conflicts with it, say so instead of building it.

## Roles and ownership

| Person | Role | Owns |
| --- | --- | --- |
| Denis | frontend | `src/app/`, `src/components/`, styling |
| Sofia | backend | `src/server/`, `drizzle/`, `deploy/`, `Dockerfile` |
| Dayana | product | `docs/product.md`, `docs/demo-script.md`, `src/content/` wording, GitHub issues |

Touching another owner's area is fine for small changes; mention it in the PR so they see it.

## Rules that judges check

- The live site must work with no sign-up or login. Visitors press "Try the demo family" and get their own seeded family (cookie `family_id`). Do not add auth.
- Core value must be real: plans, rule results, check-ins, diary sharing and bookings are computed from database state, never hardcoded UI.
- Health guidance: every rule carries a source and a checked date; the AI never diagnoses; crisis and urgent-symptom paths are fixed screens, never generated text. Diaries are private to their author unless shared per entry.
- The repo is public. Never commit secrets, `.env*`, `private/` or real personal data. Demo data is synthetic.

## Code conventions

- The UI talks to the backend only through server actions in `src/server/actions.ts` and reads through `src/server/queries.ts`. Change a signature there only together with its callers.
- Validate every action input with zod and scope every query by the caller's family id.
- Schema changes: edit `src/server/db/schema.ts`, run `pnpm db:generate`, commit the generated `drizzle/` files. Migrations run automatically on server start. Never edit an applied migration.
- Cache Components is on. Anything that reads cookies or the database must render inside `<Suspense>`; do not put `"use cache"` on per-family data.
- `better-sqlite3` is synchronous; keep queries small and indexed by `family_id`.
- Before opening a PR run `pnpm typecheck && pnpm lint && pnpm build`.

## Git workflow

- `main` deploys to production on every push. Keep it working.
- One issue, one short-lived branch (`<issue-number>-short-name`), one PR that says `Closes #N`. Merge as soon as CI is green; review is optional during the hackathon except for schema or deploy changes.
- Small PRs merged often beat a big one at 3 am.
- No AI attribution in commits, PRs or code comments.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
