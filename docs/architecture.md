# Architecture

One Next.js app. No separate backend service.

- `src/app/`, `src/components/`: pages and UI (server components by default).
- `src/server/actions.ts`: every write, as server actions. This is the API contract between frontend and backend.
- `src/server/queries.ts`: reads, shaped for screens (`getParentView`).
- `src/server/db/schema.ts`: SQLite schema via Drizzle. Migrations in `drizzle/`, applied on server start.
- `src/server/seed.ts`: the synthetic demo family. `docs/demo-script.md` depends on it.
- `src/content/`: static content such as training scenarios.

Demo sessions: no auth. "Try the demo family" creates a family and stores its id in an httpOnly cookie. Both parents belong to that family; the UI picks a role by URL or layout. `LiveRefresh` polls every 2.5 s so one parent's change shows on the other's screen.

## Production

Server `musicroombot`, Docker Compose (`deploy/compose.yml`) on `127.0.0.1:8790`, Caddy on the host for HTTPS at `parenting.unsoundmint.com` (`deploy/Caddyfile.snippet`). The SQLite file lives in the `app-data` volume. Pushes to `main` run `.github/workflows/deploy.yml`, which calls `deploy/deploy.sh` on the server.
