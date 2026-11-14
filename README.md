# Parenting Planner

Working name; the final product name is still open.

A personal guide for affluent, busy US couples raising a healthy child, from planning a pregnancy to age 9. It keeps the family's health data, mood and diaries in one place, turns them into a weekly plan for each parent using current guidelines and AI, and connects the family to doctors, psychologists and other providers when the data says they are needed.

Live (once deployed): https://parenting.unsoundmint.com. No sign-up; each visitor gets their own synthetic family.

Built for Business Cup 2.0 by Zimran, Skills track.

## Run locally

Needs Go 1.26, Node 24 with pnpm, Docker, `make`, and a C compiler (sqlc builds with cgo: Xcode command line tools on macOS, `build-essential` on Linux, WSL on Windows).

```sh
(cd web && pnpm install)
make api     # Postgres in Docker + Go API on :8091
make web     # in another terminal: http://localhost:3000
```

## Stack

Go API (net/http, Postgres, sqlc, goose) and a Next.js 16 frontend, connected by an OpenAPI contract that generates both the Go server interface and the TypeScript client. Deployed with Docker Compose behind Caddy. See [docs/architecture.md](docs/architecture.md).

## Team

- Denis Andreyev, frontend
- Sofia, backend
- Dayana, product

Product scope and decisions live in [docs/product.md](docs/product.md); how we work is in [docs/workflow.md](docs/workflow.md).
