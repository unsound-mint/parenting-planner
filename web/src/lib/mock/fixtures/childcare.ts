import type { ChildcareOption, Family } from "@/lib/api/types";
import { mock } from "../registry";
import { isNewborn } from "../timeline";
import { isoAt, isoDate, uid } from "./dates";

// Preview of the childcare tracker. The same rows as the real seed for the
// newborn family (Aisha, Marcus and Leo): an offered daycare place to decide
// on in 10 days, a waitlisted daycare and a nanny share they are researching.
// Other families start empty.

const store = new Map<string, ChildcareOption[]>();

function seed(family: Family): ChildcareOption[] {
  if (!isNewborn(family)) return [];
  return [
    { id: uid(963), name: "Nanny share with the Delgados", kind: "nanny", contact: "Priya Delgado, (617) 555-0187", monthlyCost: 1900, status: "researching", notes: "Two families, three days a week at our place. Interviewing nannies next week.", updatedAt: isoAt(-2, 19) },
    { id: uid(962), name: "Brightwater Children's Center", kind: "daycare", contact: "admissions@brightwater.example", monthlyCost: 2700, status: "waitlisted", waitlistPosition: 6, appliedOn: isoDate(-90), notes: "Toured before Leo was born. They call when an infant spot opens, likely in spring.", updatedAt: isoAt(-20, 15) },
    { id: uid(961), name: "Little Harbor Early Learning", kind: "daycare", contact: "Ms. Rivera, (617) 555-0142", monthlyCost: 2450, status: "offered", appliedOn: isoDate(-75), decideBy: isoDate(10), notes: "Infant room place from when Leo is 4 months. A $500 deposit holds it.", updatedAt: isoAt(-3, 16) },
  ];
}

async function all(family: () => Promise<Family>) {
  const f = await family();
  if (!store.has(f.id)) store.set(f.id, seed(f));
  return store.get(f.id)!;
}

export const childcareMocks = {
  ...mock("/family/childcare-options", "get", async (ctx) => ({ items: [...(await all(ctx.family))] })),
  ...mock("/family/childcare-options", "post", async (ctx) => {
    const o: ChildcareOption = { ...ctx.body, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
    (await all(ctx.family)).unshift(o);
    return o;
  }),
  ...mock("/family/childcare-options/{optionId}", "get", async (ctx) => {
    const o = (await all(ctx.family)).find((x) => x.id === ctx.path.optionId);
    if (!o) throw new Error("no such childcare option");
    return o;
  }),
  ...mock("/family/childcare-options/{optionId}", "put", async (ctx) => {
    const items = await all(ctx.family);
    const o: ChildcareOption = { ...ctx.body, id: ctx.path.optionId, updatedAt: new Date().toISOString() };
    const i = items.findIndex((x) => x.id === o.id);
    if (i >= 0) items[i] = o;
    return o;
  }),
  ...mock("/family/childcare-options/{optionId}", "delete", async (ctx) => {
    const items = await all(ctx.family);
    const i = items.findIndex((x) => x.id === ctx.path.optionId);
    if (i >= 0) items.splice(i, 1);
    return undefined as never;
  }, 204),
};
