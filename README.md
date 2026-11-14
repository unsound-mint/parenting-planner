# Parenting Planner

Working name; the final product name is still open.

A web app for couples expecting or raising a newborn in the US. Each parent has their own "Today" screen, and a shared family plan connects them. The partner rehearses the first night at home in a short simulator and commits to a real evening shift. When the baby comes home, the shifts agreed during pregnancy are already in the schedule, and handing the baby over shows the other parent the last feeding, what is done and what is next.

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
