# Backend playbook

Read this before changing anything in `api/`. It decides the things you would otherwise have to decide. If an issue needs a choice this file does not cover, make the smallest choice that fits the patterns below and list it in the PR under "Decisions not covered by api/AGENTS.md". Do not invent a new pattern silently.

For a whole issue, follow the `backend-issue` skill (`.claude/skills/backend-issue/SKILL.md`).

## Copy from these files

| You are adding | Copy |
| --- | --- |
| A table with one parent's data | `internal/store/migrations/00002_mood_checkins.sql` |
| Insert and list queries | `internal/store/queries/wellbeing.sql` |
| A domain package (business logic, transactions, audit) | `internal/wellbeing/wellbeing.go` |
| Handlers for `/members/{memberId}/...` | `internal/httpapi/wellbeing.go` |
| Endpoint tests | `internal/httpapi/wellbeing_test.go` |
| A guideline rule and its test | `internal/rules/wellbeing.go`, `TestLowMoodStreak` in `internal/rules/rules_test.go` |
| Data the plan reads | `RecentMoods` in `internal/rules/facts.go` and `internal/plan/plan.go` |
| Demo data | `seedPregnancy` in `internal/demo/demo.go` |

## Decisions already made

| Topic | Rule |
| --- | --- |
| Contract | Every endpoint is defined in `openapi.yaml` first. Denis and you both agree on contract changes. Put validation (required, enum, min, max, maxLength) in the schema; the middleware rejects bad input with 400 before your handler runs. |
| Paths | Data owned by one parent: `/members/{memberId}/<plural-noun>` using `components.parameters.MemberId`. Family-wide data: `/family/<plural-noun>`. Lowercase, hyphens. |
| Operation ids | `createX`, `listXs`, `getX`, `updateX`, `deleteX`. One tag per module; the tag name is the Go package name. |
| JSON | camelCase fields. IDs are `string` with `format: uuid`. Timestamps are `date-time` in UTC; calendar days are `date`. |
| Errors | Return the generated response types with the shared vars in `httpapi/server.go`: 401 `errNoSession`, 404 `errNoMember`. Add a new `Error` var there if you need another code; `code` is snake_case. Unexpected errors: `return nil, err` (becomes 500). Never put internal error text in a response. |
| Lists | Wrap in an object: `{ "items": [...] }`, newest first, with a fixed time window instead of pagination. |
| Acting parent | Every `/members/{memberId}` handler starts with `s.actingMember(ctx, req.MemberId)` and the `switch` from `httpapi/wellbeing.go`. Never trust an id from the body. |
| Family scope | Every query takes `family_id` and filters by it. No query reads across families. |
| Sensitive data | A table with `owner_member_id` also has `family_id` and `visibility`. Reads use a query named `...VisibleToParent` with a `-- Mirrors access.CanParentRead` comment. `TestSensitiveReadsMirrorAccessRules` enforces this. |
| Visibility default | The client sends visibility explicitly. Diary and session notes default to `private` in the UI; never widen it on the server. |
| Audit | Every create, read (list or get), update and delete of sensitive data calls `access.Audit` inside the same transaction. Entity names are snake_case singular (`mood_checkin`). |
| Transactions | Domain functions take `*pgxpool.Pool` and use `pgx.BeginFunc`. Handlers never open transactions. |
| Time | Use `s.cfg.Now()` and `s.today()`, never `time.Now()`. Tests run at `testutil.Now`. |
| Schema changes | A new goose file `000NN_short_name.sql` with `-- +goose Up` and `-- +goose Down`. Never edit or delete an existing migration (CI checks). Use `uuid` keys with `gen_random_uuid()`, `timestamptz`, `CHECK` constraints for enums, `ON DELETE CASCADE` to `families`. |
| Generated code | Never edit `*.gen.go`. Change the YAML or SQL and run `make gen`. |
| Health rules | Pure functions in `internal/rules`, each with a `Source` you opened yourself and today's date as `CheckedAt`. If the page will not load (some CDC and AAP pages block scripts), stop and ask; never cite from memory. Rule text is Dayana's; keep it plain and never diagnostic. Every rule id appears in a test (`TestEveryRuleIsTested`). |
| Dependencies | Do not add Go modules without asking Denis. |
| Logging | None in handlers. The server logs 500s. |

## Recipes

### Add an endpoint

1. Edit `openapi.yaml`: path, `operationId`, tag, request and response schemas, and every status the handler returns (each error as `description: Error` with the `Error` schema, like the existing ones).
2. `make gen`. The build now fails until `Server` implements the new method; that is your to-do list.
3. Write the handler in `internal/httpapi/<tag>.go`, calling a function in the domain package.
4. Add tests in `internal/httpapi/<tag>_test.go`. `TestEveryEndpointHasAnIntegrationTest` fails until one calls the new path.

### Add a module with sensitive data (diary, session notes, labs...)

1. Migration: copy `00002_mood_checkins.sql`, keeping `family_id`, `owner_member_id`, `visibility` and the index on `(family_id, <time column> DESC)`.
2. Queries: copy `wellbeing.sql`: one `Create...` and one `List...VisibleToParent` with the mirror comment.
3. Domain package `internal/<module>/`: copy `wellbeing.go`. Each function runs in a transaction and calls `access.Audit`.
4. Contract and handlers: the endpoint recipe above.
5. Tests: the four kinds in `wellbeing_test.go`: validation (400s), privacy (the partner sees only shared records), audit (rows written), and the effect on the plan if the data feeds a rule.
6. Demo data: add a few rows to the seed so the screen is not empty in the demo.

### Feed new data into the plan

1. Add a field to `rules.Facts` holding only what the rule needs.
2. Load it in `plan.LoadFacts` with a `...VisibleToParent` query for the viewing parent.
3. Write the rule and a table test with cases for "not yet", "due", "done" and the other parent.

### Add a demo family

Add a `Template` constant and a seed function in `internal/demo/demo.go`, add the value to `DemoTemplate` in `openapi.yaml`, and dates relative to `today` so the family is always at the same stage. Names, clinics and doctors are invented.

## Commands

From the repo root: `make db` (Postgres), `make gen`, `make test`, `make api`, `make check` (everything CI runs, required before a PR).
