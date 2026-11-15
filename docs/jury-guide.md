# Jury guide

Written for the Business Cup 2.0 judges. The project did not reach the final; this page stays as the record of how it was scored against the five questions.

The contest scores five questions. Where to look for each:

| Question | Short answer | Evidence |
| --- | --- | --- |
| Does it work? (40%) | Yes, on the live link, with no sign-up. Plans, rule results, check-ins, diaries, bookings and the practice rounds are computed from Postgres state, not hardcoded. | [Five-minute tour](#five-minute-tour), [what is real](#what-is-real-and-what-is-preview-data), [architecture](architecture.md), `make check` in CI |
| What do we sell? (20%) | A weekly plan for each parent, built from the family's own data and current guidelines, plus practice rounds for the newborn skills. They return because the plan changes with the stage, the week and every check-in. | [docs/product.md](product.md), the pricing page (Free and Plus, $14.99 a month or $119.99 a year) |
| Who do we sell to? (15%) | Working US couples, 25 to 45, expecting or raising a child up to age 9, who already pay for nannies, night nurses and sleep consultants. Both parents are users. | [docs/product.md](product.md), pain points with sources in [docs/research.md](research.md) |
| Why does it make money? (15%) | On Plus alone ($120 to $180 a year) $100M ARR is roughly 560k to 830k paying families, 15% to 23% of one year's US births, so the model depends on keeping families across the nine-year journey, with provider bookings as an unsized upside. | [docs/business-case.md](business-case.md): price, lifetime value, acquisition ceiling, size. Sources in [docs/research.md](research.md) |
| Is it new? (10%) | The closest whole-journey product we found is Maven Clinic, which is sold to employers and centered on women. The other products we checked cover one slice: sleep, development, play kits, a registry. | [docs/business-case.md](business-case.md) and the competitor list in [docs/research.md](research.md). Nanit, Tinyhood, Oath Care, Juniper and Mae are not checked yet. |

Track: Skills. The pain is that new parents learn newborn care and how to split it from reading, then meet the real night with no practice. The Learn section has paths, a practice simulator and a virtual baby.

### Five-minute tour

1. Open the live link. Four synthetic families are on the start page, each at a different stage. Pick one, for example "Leo is 7 weeks old". You get your own copy, so change whatever you like.
2. **This week**: read the next step and press "Why?" for the reason, written from this family's data. Sources are links inside the sentence.
3. Log a mood check-in with the faces. It is private to that parent.
4. Switch to the partner with the name switch at the top. They get a different plan from the same family, and cannot see the first parent's check-ins or diary. The window icon next to the switch opens the other parent in a second window.
5. **Learn**, then **Practice**: a short round of the newborn skills a parent will need.
6. **Plan**: Timeline, Calendar and Money and paperwork. **Health**: journal, check-ins, health records, Find help.
7. Press "Skip a week" in the top bar: the family's demo clock moves seven days and every due date and week of pregnancy is recomputed. Starting a new demo is the reset.
8. "Urgent help" at the top right is a fixed screen with hotlines, never generated text.
9. Pricing has Free and Plus. Upgrading starts a Stripe checkout in test mode: use the test card shown on the page, no real money moves.

## What is real and what is preview data

Real, computed from database state on every request:

- The demo families and their people, copied per visitor into Postgres, with dates relative to today.
- The rules engine in `api/internal/rules`: which steps are due, upcoming or overdue for each parent, with the reason and the source. Rules are pure functions with tests.
- Check-ins, diary, journal, calendar, bookings, shifts, tasks, health records, who may read each of them, and the audit log of reads.
- Every endpoint in `api/openapi.yaml` is implemented except the child passport, which still answers 501.

Preview data: a screen whose endpoint answers 501 shows typed sample data from `web/src/lib/mock` instead of being hidden, and the top bar says "Demo data". Production has this switched on, but it applies only to 501 answers, so today it affects the child passport card.

There is no AI in the plan. The weekly plan comes from the rules engine alone. The code has an optional layer that asks Claude to reword the plan, and a storybook that can use it too; both are off unless `ANTHROPIC_API_KEY` is set, check what comes back, and fall back to the rules and a template. We do not count on it for any claim above.
