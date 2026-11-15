# Business case

Numbers for the "Why does it make money?" and "What do we sell?" questions. Every figure is either from [research.md](research.md), from `web/src/lib/plans.ts`, or arithmetic on those two. Anything we have not measured is marked as a hypothesis.

## Who pays

The parent pays out of their own pocket (B2C). One subscription covers the family, so both parents are unlocked. Providers are reached through the directory; a booking fee is a possible extra source, never the base of the model.

## Price

| Tier | Price | Source |
| --- | --- | --- |
| Free | $0 | `plans.ts` |
| Plus | $29 a month, $348 a year | `plans.ts` |
| Concierge | $99 a month, $1,188 a year | `plans.ts` |

Consumer health memberships run from $199 a year to about $3,300 a year (research.md, pricing signal). Plus sits at the low end of that range.

## Retention and lifetime value

- Median annual renewal for health apps is 54% (RevenueCat 2026, linked in research.md).
- At 54% renewal the expected paying life is 1 / (1 − 0.54) ≈ 2.2 years. This is arithmetic, not a measurement of our product.
- Plus revenue per paying family over that life: $348 × 2.2 ≈ $760. Concierge: $1,188 × 2.2 ≈ $2,600.
- Why a family should renew: the plan is rebuilt every week from the stage and the family's own data, so the product changes as the child grows. A nine-year journey is the answer to stage churn, but only if the product carries over; we have no renewal data yet.

## Acquisition cost

We have not run ads, so any CAC figure would be invented and we do not state one. What the numbers say:

- Break-even: with a lifetime value near $760, paying back needs a blended CAC under that figure. The common 3:1 rule of thumb puts the ceiling near $250 per paying family (hypothesis, rule of thumb).
- Channels to test, in the order we would try them (hypotheses, none measured): OB and pediatric offices and birth classes that hand out a link at the moment of need; search for the stage-specific questions parents already ask; the partner invite built into the product, which brings the second parent in for free.

## Size

- 3.6M US births in 2025 and 32.9M US families with children under 18 (research.md, market).
- $100M ARR at a blended $250 to $600 a year is roughly 170k to 400k paying families, about 5% to 11% of one year's births.

## Why this is new

The closest whole-journey product we found, Maven Clinic, is sold to employers and centered on women. We sell to the family, cover both parents, and start from their own records. Other products we checked cover one slice (sleep, development, play kits, a registry, pediatric text care). Nanit, Tinyhood, Oath Care, Juniper and Mae are not checked yet.

## What we have not validated

- No interviews or surveys with US parents, no paying customers. Checkout is in Stripe test mode.
- No measured conversion, CAC or renewal for this product.
