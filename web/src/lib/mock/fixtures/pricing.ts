import { mock } from "../registry";

export const pricingMocks = {
  ...mock("/family/upgrade-intents", "post", (ctx) => ({ tier: ctx.body.tier, requestedAt: new Date().toISOString() })),
  // No Stripe in preview: the "payment page" is the success screen itself.
  ...mock("/members/{memberId}/checkout-sessions", "post", (ctx) => ({
    id: "cs_test_preview",
    tier: ctx.body.tier,
    status: "open",
    url: `/pricing/success?session_id=cs_test_preview&tier=${ctx.body.tier}`,
    paid: false,
  })),
  ...mock("/members/{memberId}/checkout-sessions/{sessionId}", "get", (ctx) => ({
    id: ctx.path.sessionId,
    tier: "plus",
    status: "complete",
    paid: true,
  })),
};
