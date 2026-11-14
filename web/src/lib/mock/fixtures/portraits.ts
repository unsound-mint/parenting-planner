import type { Family, Portrait } from "@/lib/api/types";
import { mock } from "../registry";
import { isoAt } from "./dates";

// Preview of the portrait flipbook. The same slots as the real seed
// (api/internal/demo/portraits.go): drawn portraits, no photos. Pregnancy: the
// bump every four weeks up to week 24. Newborn: the bump at 12, 20, 28 and 36
// weeks, then Leo at birth and at one month. Preschool: Ava at birth, six
// months and every birthday. Planning: nothing yet.

const id = (familyId: string, n: number) => familyId.slice(0, 24) + (0xf00 + n).toString(16).padStart(12, "0");

function seededSlots(family: Family): Omit<Portrait, "id" | "createdAt" | "kind">[] {
  const child = family.children[0];
  switch (family.template) {
    case "pregnancy":
      return [8, 12, 16, 20, 24].map((week) => ({ week }));
    case "newborn":
      return [...[12, 20, 28, 36].map((week) => ({ week })), ...(child ? [0, 1].map((month) => ({ childId: child.id, month })) : [])];
    case "preschool":
      return child ? [0, 6, 12, 24, 36, 48].map((month) => ({ childId: child.id, month })) : [];
    default:
      return [];
  }
}

// Newest moment first, like the API: children by month, then the bump by week.
const order = (a: Portrait, b: Portrait) =>
  (b.month ?? -1) - (a.month ?? -1) || (b.week ?? 0) - (a.week ?? 0);

export const portraitMocks = {
  ...mock("/members/{memberId}/portraits", "get", async (ctx) => {
    const family = await ctx.family();
    return {
      items: seededSlots(family)
        .map((s, i) => ({ ...s, id: id(family.id, i), kind: "illustration" as const, createdAt: isoAt(-1, 12) }))
        .sort(order),
    };
  }),
  // The bytes are not kept in a preview: the frame shows the local preview until reload.
  ...mock("/members/{memberId}/portraits", "post", (ctx) => ({
    id: crypto.randomUUID(),
    childId: ctx.query.childId,
    month: ctx.query.month !== undefined ? Number(ctx.query.month) : undefined,
    week: ctx.query.week !== undefined ? Number(ctx.query.week) : undefined,
    kind: "photo" as const,
    uploadedBy: ctx.path.memberId,
    createdAt: new Date().toISOString(),
  })),
  ...mock("/members/{memberId}/portraits/{portraitId}", "delete", () => undefined as never, 204),
};
