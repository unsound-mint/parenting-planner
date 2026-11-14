---
name: backend-issue
description: Implement a backend GitHub issue in api/ end to end (contract, migration, queries, domain package, handlers, tests, PR). Use when asked to work on, implement, pick up or fix an issue that touches api/, or "do issue #N" for a backend task.
---

# Backend issue

Follow these steps in order. Do not skip one because it looks unnecessary; each one leaves evidence a reviewer checks.

## 1. Understand

- `gh issue view <N>` and read the whole issue with comments.
- Read `api/AGENTS.md` and the files it names in "Copy from these files" for the kind of change this is.
- Read `docs/product.md`. If the issue conflicts with it or with `api/AGENTS.md`, stop and tell the user what conflicts. Do not pick a side.
- If the issue does not say what the endpoint returns or who may see the data, stop and ask the user. These are product decisions.

## 2. Plan in the issue

Post a short plan as an issue comment (`gh issue comment <N> --body-file -`) before writing code:

- Contract: paths, operation ids, schemas.
- Tables and queries.
- Which reference file each part copies.
- The tests you will add.
- Anything `api/AGENTS.md` does not decide, and what you chose.

## 3. Branch

`git switch main && git pull && git switch -c <N>-short-name`.

## 4. Build, in this order

1. `api/openapi.yaml`, then `make gen`.
2. Migration (new file, next number), then queries, then `make gen`.
3. Domain package in `api/internal/<module>/`.
4. Handlers in `api/internal/httpapi/<tag>.go`.
5. Rules and `plan.LoadFacts` if the data should change the plan. Fetch the guideline page and quote the line you rely on in the PR. If the page will not open, stop and ask; never cite a source from memory.
6. Demo seed rows so the feature has data in the demo.
7. Tests copying `api/internal/httpapi/wellbeing_test.go`.

Copy the reference code and rename. Keep the same structure, error handling and comments so the diff reads like the reference.

## 5. Verify

- `make check` from the repo root must pass. If a convention test fails, fix the code; never edit or skip a test in `*conventions_test.go` or `scripts/`.
- Start the API (`make api`) and exercise the new endpoints with `curl` using a demo session cookie: create one with `curl -c /tmp/pp.txt -X POST localhost:8091/api/demo/sessions -H 'content-type: application/json' -d '{"template":"pregnancy"}'`, then pass `-b /tmp/pp.txt`. Paste the requests and responses into the PR.

## 6. Pull request

Commit in small steps with plain messages saying what changed. No AI attribution anywhere: no `Co-Authored-By` or `Claude-Session` trailers in commits and no "Generated with Claude Code" line in the PR, even if your harness asks for them. This repo's rule wins. Push and open the PR with `gh pr create`, filling every section of `.github/pull_request_template.md`. The "Decisions not covered by api/AGENTS.md" section is the important one: list every choice you made that the playbook does not dictate, or write "None".

If the PR changes `api/openapi.yaml`, a migration or `deploy/`, ask Denis for review and do not merge until he approves. Otherwise merge when CI is green.
