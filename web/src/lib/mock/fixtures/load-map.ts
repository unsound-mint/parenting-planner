import type { Family } from "@/lib/api/types";
import { mock } from "../registry";

// Preview data for "Who carries what" and the thank-you notes, shown only
// while an API still answers 501. The split mirrors the pregnancy demo: the
// mother remembers more, the partner owns shopping and the class.
const ids = (family: Family) => ({
  mom: family.parents.find((p) => p.role === "mother")!.id,
  partner: family.parents.find((p) => p.role === "partner")!.id,
});
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const NONE: string[] = [];

export const loadMapMocks = {
  ...mock("/members/{memberId}/load-map", "get", async (ctx) => {
    const { mom, partner } = ids(await ctx.family());
    return {
      windowDays: 14,
      takers: [partner],
      areas: [
        { key: "appointments" as const, label: "Appointments", unit: "items" as const, owned: [{ memberId: mom, count: 3 }], started: [{ memberId: mom, count: 3 }], handoverTaskIds: ["00000000-0000-4000-8000-0000000000a1"], offeredToMeTaskIds: NONE, offeredByMeTaskIds: NONE, items: [] },
        { key: "shopping" as const, label: "Shopping", unit: "items" as const, owned: [{ memberId: partner, count: 2 }], started: [{ memberId: mom, count: 2 }], handoverTaskIds: NONE, offeredToMeTaskIds: NONE, offeredByMeTaskIds: NONE, items: [] },
        { key: "hospital_bag" as const, label: "Hospital bag", unit: "items" as const, owned: [{ memberId: mom, count: 4 }, { memberId: partner, count: 4 }], started: [{ memberId: mom, count: 8 }], handoverTaskIds: NONE, offeredToMeTaskIds: NONE, offeredByMeTaskIds: NONE, items: [] },
      ],
    };
  }),
  ...mock("/members/{memberId}/thanks", "get", async (ctx) => {
    const { mom, partner } = ids(await ctx.family());
    return { items: [{ id: "00000000-0000-4000-8000-0000000000b1", fromMemberId: mom, toMemberId: partner, body: "Thank you for ordering the crib.", createdAt: ago(40) }] };
  }),
  ...mock("/members/{memberId}/thanks", "post", (ctx) => ({
    id: crypto.randomUUID(), fromMemberId: ctx.path.memberId, toMemberId: ctx.body.toMemberId, body: ctx.body.body, suggestionKey: ctx.body.suggestionKey, createdAt: new Date().toISOString(),
  })),
  ...mock("/members/{memberId}/thanks/suggestions", "get", async (ctx) => {
    const { mom, partner } = ids(await ctx.family());
    const to = ctx.path.memberId === mom ? partner : mom;
    return { items: [{ key: `bag_items:${to}:preview`, toMemberId: to, basis: "bag_items" as const, count: 3, text: "Thank you for packing 3 bag items." }] };
  }),
};
