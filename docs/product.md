# Product

Owner: Dayana. This is the source of truth for scope. Evidence behind it: [research.md](research.md).

## Vision

The personal guide for raising a physically and mentally healthy child, from planning a pregnancy to age 9. It knows the family (health records, lab results, mood, diaries, care team, the child's development) and tells each parent what matters this week, then connects them to the right people: their doctor, their clinic, a psychologist, a lactation consultant, a tutor.

Personalization is the product. Two families at the same stage should see different things because their data is different.

## Who we sell to

Affluent US couples, 25 to 45, both working, who would pay for help but do not have time to work out what they should be thinking about at each stage. They already pay for nannies, night nurses, doulas and sleep consultants. They do not have one place that knows their situation.

Both parents are users. Most competitors serve the mother only; fathers have about 10% perinatal depression and are rarely screened (research.md).

## What we sell

- **A weekly plan per parent**, built from the family's own data and current guidelines: what to do, what to ask the doctor, what to watch for.
- **One home for the family's health data**: health passports for both parents and the child, lab results, vaccines, growth, screenings, care team and clinic, insurance.
- **Mental health as a first-class part**: mood check-ins, a private diary, short notes after psychologist sessions, and recurring patterns turned into topics to bring to the next session.
- **The ecosystem**: vetted psychologists, doulas, lactation consultants, sleep consultants, child therapists and tutors, booked from the plan when the data says they are needed.
- **The couple layer**: shared family plan, split responsibilities, night shifts and handoffs.

Why they come back tomorrow: the plan changes as the data and the stage change, and every check-in improves it.

## How it makes money (proposal, Dayana to decide)

| Tier | Price | What is in it |
| --- | --- | --- |
| Free | $0 | Stage guide, health passport, crisis and help contacts |
| Plus | ~$29/mo | Weekly plan for both parents, full data hub, pattern insights, partner layer |
| Concierge | ~$99/mo | Plus a human care navigator and one psychologist session a month |
| Marketplace | take rate | Bookings with providers in the ecosystem |

At a blended $250 to $600 a year, $100M ARR needs roughly 170k to 400k paying families, about 5% to 11% of one year's US births, retained across a 9-year journey.

## Product principles

1. **Data in, personal action out.** Every recommendation names which data triggered it and which guideline it follows, with the source and the date it was checked.
2. **Private by default.** Diaries and session notes belong to the person who wrote them. Partner and psychologist see only what that person shares, item by item.
3. **Guide, not doctor.** The plan explains, reminds and prepares questions. It never diagnoses. Urgent symptoms and self-harm go to fixed screens with hotlines, never generated text.
4. **Both parents, separately and together.** Each parent has their own screen; the family plan connects them.

## Hackathon scope

The backlog lives in GitHub issues; Dayana sets it. The milestone "Hackathon MVP (22h)" is the demo scope:

- Tier 1 (`hackathon:must`, P0) must work end to end on the live site: T1.1 to T1.15 and G1 to G12. Never cut T1.2, T1.6, T1.8, T1.9, T1.10. Checkpoint: all of Tier 1 working by hour 14.
- Payments (#25, T2.8: paywall and Stripe test checkout) is P0 and never cut. The FAQ says a pricing page alone is not enough.
- The rest of Tier 2 (`hackathon:demo-grade`, P1) starts only after Tier 1 works. If we fall behind, cut in reverse order of `docs/demo-script.md`: what the demo shows last goes first.

Later milestones (Phase 0 to 4) are the roadmap after the hackathon, not demo scope. The vision above is where the product goes; the milestone is what we build now. When they differ, the milestone wins for the demo.

The demo has no login (contest rule): visitors get a fresh copy of the demo family and switch between its people. Web only.

## Decisions at submission

- Track: Skills. Parents learn newborn care and how to split it by practising, not only reading.
- Prices as built in `web/src/lib/plans.ts`: Free, Plus $29 a month, Concierge $99 a month. Checkout runs in Stripe test mode.
- Working name: Parenting Planner (`web/src/lib/product.ts`).
- Four demo families: planning, 25 weeks pregnant, newborn, preschooler (`web/src/lib/demo-families.ts`).
- Not checked before the deck: Nanit, Tinyhood, Oath Care, Juniper and Mae. Do not claim nobody does this until they are.
- The plan comes from the rules engine. AI is optional and off by default.
