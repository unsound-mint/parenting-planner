# How we work

## Roles

- Dayana, product: decides scope, writes issues, owns `docs/product.md`, the demo script and the pitch deck.
- Sofia, backend: the Go API in `api/`, database, seed data, deploy. Start with `api/AGENTS.md`.
- Denis, frontend: screens, design, UX.

Everyone works with Claude Code in this repo. Claude reads `AGENTS.md` automatically.

## Issues

Every piece of work is a GitHub issue. A good issue has:

- what the user does and sees, in one or two sentences;
- acceptance criteria as a checklist someone can verify on the live site;
- one area label (`frontend`, `backend`, `product`) and one priority (`P0` demo-critical, `P1` should have, `P2` nice to have).

If a feature needs both frontend and backend, write two issues and link them, plus the endpoint change to `api/openapi.yaml`. The contract change lands first, so frontend can build against generated types while backend implements it.

### For Dayana: working with Claude

Open Claude Code in this repo and describe what you want in plain words, in any language. For example:

- "Create an issue: the partner should see a summary of their training score after the simulator. Frontend, P1."
- "Read docs/product.md and the open issues. What is missing for the demo script to work?"
- "We decided the name is X and the price is $12/month. Update docs/product.md and web/src/lib/product.ts."
- "Go through the demo script on the live site and tell me which steps fail."

Claude creates issues with `gh issue create` using a template (Backend task for anything in `api/`, Task otherwise), and can open small PRs for doc or wording changes. Engineers pick up issues by assigning themselves.

## Timeline (local time)

| When | Milestone |
| --- | --- |
| Nov 14, 15:00 | Scope locked, P0 issues written, first deploy live |
| Nov 14, 22:00 | Demo script works end to end in production |
| Nov 15, 08:00 | Feature freeze, only fixes |
| Nov 15, 10:00 | Deck final, demo rehearsed on production |
| Nov 15, 11:00 | Captain submits (deck PDF, live link, repo link); 1 hour buffer |

## After submission

Judges open the production link between the 12:00 deadline and the 15:00 finalist announcement, and it must stay up until the final ends. `main` deploys on every push, so after 11:00 merge only fixes you have clicked through on production, and merge nothing after the 12:00 submission until the final is over.
