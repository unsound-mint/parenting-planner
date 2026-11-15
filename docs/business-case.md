# Business case

Numbers for the "Why does it make money?" and "What do we sell?" questions. Every figure is either from [research.md](research.md), from `web/src/lib/plans.ts`, or arithmetic on those two. Anything we have not measured is marked as a hypothesis.

## Who pays

The parent pays out of their own pocket (B2C). One subscription covers the family, so both parents are unlocked. Providers are reached through the directory; a booking fee is a possible extra source, never the base of the model.

## Price

| Tier | Price | Source |
| --- | --- | --- |
| Free | $0 | `plans.ts` |
| Plus | $14.99 a month, or $119.99 a year ($10 a month, 33% less than paying monthly) | Denis, Nov 15. `plans.ts` and the Stripe prices are being brought in line |
| Concierge | $99 a month, $1,188 a year | `plans.ts`, not changed |

Consumer health memberships run from $199 a year to about $3,300 a year (research.md, pricing signal). Plus is priced under that range, closer to Huckleberry's about $120 a year.

## Retention and lifetime value

- Median annual renewal for health apps is 54% (RevenueCat 2026, linked in research.md).
- At 54% renewal the expected paying life is 1 / (1 − 0.54) ≈ 2.2 years. This is arithmetic on a category median, not a measurement of our product.
- Plus revenue per paying family over that life: about $260 on the annual plan ($119.99 × 2.2) and about $390 on the monthly plan ($179.88 × 2.2, assuming monthly subscribers renew at the same yearly rate, which is optimistic). Concierge: about $2,600.
- Why a family should renew: the plan is rebuilt every week from the stage and the family's own data, so the product changes as the child grows. A nine-year journey is the answer to stage churn, but only if the product carries over; we have no renewal data yet.

## Acquisition cost

We have not run ads, so any CAC figure would be invented and we do not state one. What the numbers say:

- Break-even: with a Plus lifetime value of $260 to $390, paying back needs a blended CAC under that. The common 3:1 rule of thumb puts the ceiling at about $90 to $130 per paying family (hypothesis, rule of thumb). That is tight for paid ads, which is why the channels below start with free ones.
- Channels to test, in the order we would try them (hypotheses, none measured): OB and pediatric offices and birth classes that hand out a link at the moment of need; search for the stage-specific questions parents already ask; the partner invite built into the product, which brings the second parent in for free.

## Size

- 3.6M US births in 2025 and 32.9M US families with children under 18 (research.md, market).
- $100M ARR on Plus alone ($120 to $180 a year) needs roughly 560k to 830k paying families, about 15% to 23% of one year's births. That is a lot, and it is why the plan keeps families for the whole nine years, not one stage.
- The earlier 170k to 400k families assumed a blended $250 to $600 a year. That needs a real share of Concierge ($1,188 a year) and marketplace bookings on top of Plus. Treat it as the upside case until we have conversion data.

## Why this is new

The closest whole-journey product we found, Maven Clinic, is sold to employers and centered on women. We sell to the family, cover both parents, and start from their own records. Other products we checked cover one slice (sleep, development, play kits, a registry, pediatric text care). Nanit, Tinyhood, Oath Care, Juniper and Mae are not checked yet.

## What we have not validated

- No interviews or surveys with US parents, no paying customers. Checkout is in Stripe test mode.
- No measured conversion, CAC or renewal for this product.
