import { mock } from "../registry";

// Demo time. Nothing is stored, so the skip answers with the family moved one
// more week from what GET /family says now; a reload shows the real clock again.
export const demoMocks = {
  ...mock(
    "/family/demo-time-skips",
    "post",
    async (ctx) => {
      const family = await ctx.family();
      return { ...family, demoDaysAhead: (family.demoDaysAhead ?? 0) + 7 };
    },
    200,
  ),
};
