# Parenting Planner

Working name; the final product name is still open.

A personal guide for affluent, busy US couples raising a healthy child, from planning a pregnancy to age 9. It keeps the family's health data, mood and diaries in one place, turns them into a weekly plan for each parent using current guidelines and AI, and connects the family to doctors, psychologists and other providers when the data says they are needed.

Live: https://parenting.unsoundmint.com (no sign-up, each visitor gets their own synthetic family)

Built for Business Cup 2.0 by Zimran, Skills track.

## Run locally

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

The SQLite database is created in `data/app.db` on first request and migrated automatically.

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | Generate route types and run `tsc` |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Create a migration after editing `src/server/db/schema.ts` |
| `pnpm db:studio` | Browse the local database |

## Stack

Next.js 16 (App Router, server actions), SQLite with Drizzle ORM, Tailwind CSS. Deployed as one Docker container behind Caddy. See [docs/architecture.md](docs/architecture.md).

## Team

- Denis Andreyev, frontend
- Sofia, backend
- Dayana, product

Product scope and decisions live in [docs/product.md](docs/product.md); how we work is in [docs/workflow.md](docs/workflow.md).
