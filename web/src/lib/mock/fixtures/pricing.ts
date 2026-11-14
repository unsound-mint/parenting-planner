import { mock } from "../registry";

export const pricingMocks = {
  ...mock("/family/upgrade-intents", "post", (ctx) => ({ tier: ctx.body.tier, requestedAt: new Date().toISOString() })),
};
