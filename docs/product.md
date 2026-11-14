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
| Plus | ~$29/mo | AI weekly plan for both parents, full data hub, pattern insights, partner layer |
| Concierge | ~$99/mo | Plus a human care navigator and one psychologist session a month |
| Marketplace | take rate | Bookings with providers in the ecosystem |

At a blended $300 to $600 a year, $100M ARR needs roughly 170k to 400k paying families, about 5% to 11% of one year's US births, retained across a 9-year journey.

## Product principles

1. **Data in, personal action out.** Every recommendation names which data triggered it and which guideline it follows, with the source and the date it was checked.
2. **Private by default.** Diaries and session notes belong to the person who wrote them. Partner, psychologist and AI see only what that person shares, item by item.
3. **Guide, not doctor.** The AI explains, plans, reminds and prepares questions. It never diagnoses. Urgent symptoms and self-harm go to fixed screens with hotlines, never generated text.
4. **Both parents, separately and together.** Each parent has their own screen; the family plan connects them.

## Hackathon scope

The jury scores "works end to end, core value real" at 40%. Breadth wins only if every screen runs on real data through the same engine. So we build one engine and many surfaces, and we demo with several families at different stages to prove personalization.

### Must work in production

1. **Demo entry without login.** Pick a family to explore: planning, 2nd trimester, newborn at home, 4-year-old. Each is a fresh copy of rich synthetic data, switchable between Mom and Partner.
2. **Journey timeline** from planning to age 9, with the family's current position and what is coming.
3. **Guideline rules engine**: sourced, versioned rules (screening windows, vaccines, milestones, warning signs) evaluated against the family's data to produce due, overdue and upcoming items.
4. **AI weekly plan** per parent: takes the rule results, recent mood, diary topics the person chose to share and the stage, and writes a short personal plan with reasons and sources. Generated live with the Claude API, with guardrails.
5. **Health passport**: parents and child, with lab results, vaccines, growth, allergies and care team (doctor, clinic, pediatrician, psychologist).
6. **Mood check-ins and private diary** with per-entry sharing (keep private, share with partner, add to the psychologist agenda). Pattern detection over check-ins (for example "low sleep and low mood three days running").
7. **Psychologist flow**: the agenda built from shared topics, booking with a synthetic provider, and a short note after the session that feeds the next plan.
8. **Ecosystem directory**: providers by type and state, suggested from the plan, with a booking request.
9. **Couple layer**: shared plan, task ownership and the shift handoff.
10. **Pricing page** with the tiers above, and an upgrade flow that records intent.
11. **Safety**: the crisis screen and help contacts, always reachable.

### Out of scope for the hackathon

Real accounts and login, real payments, real provider integrations, EHR or insurer connections, calendar sync, file uploads of real lab PDFs, native mobile apps.

## Open decisions (Dayana)

- [ ] Final product name (`src/lib/product.ts` and the README title)
- [ ] Track: Skills (learning to raise a healthy child) or Money. Pick one and write the one-sentence pain statement.
- [ ] Prices and tier contents
- [ ] The four demo families: who they are and what in their data drives a visibly different plan
- [ ] Competitor check on Nanit, Tinyhood, Oath Care, Juniper and Mae before the deck claims nobody does this
- [ ] Captain who submits
