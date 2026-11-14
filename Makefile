# Common tasks. Run from the repo root.
.PHONY: gen db api web test check

DEV_DB := postgres://parenting:parenting@localhost:5433/parenting?sslmode=disable

## Regenerate Go server, sqlc queries and the TypeScript client from the contract and SQL.
gen:
	cd api && go generate ./... && go tool sqlc generate
	cd web && pnpm gen:api

## Start the local Postgres.
db:
	docker compose -f compose.dev.yml up -d --wait

## Run the API on :8091 against the local Postgres.
api: db
	cd api && DATABASE_URL=$(DEV_DB) COOKIE_SECURE=false ADDR=127.0.0.1:8091 go run ./cmd/server

## Run the web app on :3000 (proxies /api to :8091).
web:
	cd web && pnpm dev

test: db
	cd api && TEST_DATABASE_URL=$(DEV_DB) go test ./...

## Everything CI checks.
check: gen test
	cd api && go vet ./...
	cd web && pnpm typecheck && pnpm lint && pnpm build
	git diff --exit-code -- 'api/**/*.gen.go' web/src/lib/api || (echo "generated code is out of date: run make gen and commit" && exit 1)
