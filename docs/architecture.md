# Architecture

Two apps in one repo with a written contract between them.

```
api/openapi.yaml        contract; Go server and TS client are generated from it
api/                    Go service (Sofia)
  cmd/server/           entrypoint: config, migrations, HTTP server
  internal/httpapi/     handlers, one file per OpenAPI tag; api.gen.go is generated
  internal/store/       Postgres: migrations/ (goose), queries/ (sqlc) -> *.gen.go
  internal/rules/       guideline rules engine, pure and unit-tested
  internal/plan/        loads a parent's visible data into rules.Facts
  internal/access/      who may read which sensitive record, and the audit log
  internal/wellbeing/   mood check-ins: the reference module new modules copy
  internal/demo/        synthetic demo families and sessions
  internal/testutil/    HTTP + Postgres test client used by integration tests
  AGENTS.md             backend playbook: decisions and recipes
scripts/                CI checks that also run in `make check`
web/                    Next.js app (Denis)
  src/lib/api/          generated schema, browser client, server client
deploy/                 production compose, Caddy snippet, deploy script
```

## Request flow

The browser only talks to one origin. Caddy sends `/api/*` to the Go service and everything else to Next.js. In local dev, `next.config.ts` rewrites `/api/*` to the Go service instead, so the same paths work.

Server components call the API from the Next.js server with `serverApi()`, which forwards the visitor's cookie. Client components use `api` from `src/lib/api/client.ts`.

## Sessions

No login, by contest rule. `POST /api/demo/sessions` copies a synthetic family and sets an httpOnly `pp_session` cookie; only its sha256 is stored. Every other endpoint resolves the family from that cookie. Seeds use dates relative to today, so a demo family is always at the same stage.

## Personalization

`internal/plan` loads only the data the viewing parent may see (`internal/access`), builds `rules.Facts`, and `rules.Plan` returns items with status, due date, a reason based on the family's data, and a source. The AI layer will sit on top of these items: it ranks and explains them, and never adds medical actions the engine did not produce.

## Requests inside the API

The generated router validates every request against `openapi.yaml` (400 `invalid_request` on bad input), then resolves the session cookie to a family. Handlers for `/members/{memberId}/...` check that the member is in that family, call a domain package, and map rows to API types. Domain functions run their queries and the `access.Audit` row in one transaction.

## Modules

Each module is a Go package that owns its tables and its endpoints in the contract. Built: family and members, plan, wellbeing (mood check-ins). Planned: diary, health records (passport, labs, vaccines, growth), care team and providers, bookings, planner (AI), billing. `api/AGENTS.md` has the recipe for adding one.

Convention tests (`*/conventions_test.go`) check the rules a reviewer would otherwise check by hand: sensitive tables have visibility, sensitive reads mirror `internal/access`, every rule and endpoint has a test. `scripts/check-migrations.sh` fails if an applied migration changes.

## Local development

```sh
make db      # Postgres 17 in Docker on 127.0.0.1:5433
make api     # Go API on :8091
make web     # Next.js on :3000, proxies /api to :8091 (run `pnpm install` in web/ once)
make gen     # regenerate Go server, sqlc queries and the TS client
make test    # Go tests including the HTTP + Postgres integration test
make check   # everything CI runs
```

Go tools (oapi-codegen, sqlc) are pinned in `api/go.mod` and run with `go tool`; nothing to install besides Go 1.26, Node 24, pnpm, Docker, `make` and a C compiler (sqlc needs cgo: Xcode command line tools on macOS, `build-essential` on Linux, WSL on Windows).

## Production

Server `musicroombot`, Docker Compose (`deploy/compose.yml`): Postgres, the API on `127.0.0.1:8792`, Next.js on `127.0.0.1:8790`. Caddy on the host serves `parenting.unsoundmint.com` (`deploy/Caddyfile.snippet`). `deploy/.env` on the server holds `POSTGRES_PASSWORD` and the optional `ANTHROPIC_API_KEY` (see the header of `deploy/compose.yml`); the key exists only there and in the API's environment. Pushes to `main` run `.github/workflows/deploy.yml`, which calls `deploy/deploy.sh` on the server once the repo variable `DEPLOY_ENABLED` is `true`.
