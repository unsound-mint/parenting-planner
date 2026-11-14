import type { Family, InsuranceCall } from "@/lib/api/types";
import { mock } from "../registry";
import { couple, isNewborn, olderStage } from "../timeline";
import { isoAt, isoDate, uid } from "./dates";

// Preview data for the insurance call log: two calls by Emily (one shared with
// Jake about adding the baby, one private about a claim) and one by Jake shared
// with Emily. Like the API, the list returns your own calls plus the other
// parent's calls shared with you.

const store = new Map<string, InsuranceCall[]>();
const INSURER = "Blue Harbor Health";

function seed(family: Family): InsuranceCall[] {
  const { mother, partner } = couple(family);
  const at = (n: number) => isoAt(n, 15, 20);
  // Planning: Daniel asked about fertility coverage. Preschool: Tom asked about the check-up and vision screen.
  const stage = olderStage(family);
  if (stage === "planning") {
    return [{ id: uid(905), authorId: partner.id, calledAt: at(-4), insurer: INSURER, representative: "Dana", referenceNumber: "FC-2081", topic: "coverage", summary: "A preconception visit is covered as preventive care. Carrier screening needs a referral; they will send the form.", followUpOn: isoDate(5), visibility: "partner", createdAt: at(-4) }];
  }
  if (stage === "child") {
    return [{ id: uid(906), authorId: partner.id, calledAt: at(-6), insurer: INSURER, representative: "Marcus", referenceNumber: "WC-3317", topic: "coverage", summary: "The 4-year check-up and the vision screen are covered with no copay at an in-network clinic.", visibility: "partner", createdAt: at(-6) }];
  }
  if (isNewborn(family)) {
    return [
      { id: uid(907), authorId: mother.id, calledAt: at(-30), insurer: INSURER, representative: "Dana", referenceNumber: "AB-51877", topic: "add_baby", summary: "Leo was added with his birth certificate, effective from his birth date. The new card is in the mail.", visibility: "partner", createdAt: at(-30) },
      { id: uid(908), authorId: mother.id, calledAt: at(-12), insurer: INSURER, referenceNumber: "CLM-80214", topic: "claim", summary: "The hospital bill for the birth was billed twice. They will correct it.", followUpOn: isoDate(2), visibility: "private", createdAt: at(-12) },
      { id: uid(909), authorId: partner.id, calledAt: at(-3), insurer: INSURER, representative: "Ravi", referenceNumber: "HS-6042", topic: "coverage", summary: "The 2-month well visit and its vaccines are covered with no copay at an in-network pediatrician.", visibility: "partner", createdAt: at(-3) },
    ];
  }
  return [
    { id: uid(900), authorId: mother.id, calledAt: at(-9), insurer: INSURER, representative: "Dana", referenceNumber: "AB-48213", topic: "add_baby", summary: "Newborns are covered for 30 days. Send the birth certificate to add the baby after the birth.", followUpOn: isoDate(3), visibility: "partner", createdAt: at(-9) },
    { id: uid(901), authorId: mother.id, calledAt: at(-20), insurer: INSURER, referenceNumber: "CLM-77120", topic: "claim", summary: "Ultrasound claim was billed twice. They will correct it.", followUpOn: isoDate(10), visibility: "private", createdAt: at(-20) },
    { id: uid(902), authorId: partner.id, calledAt: at(-5), insurer: INSURER, representative: "Marcus", referenceNumber: "HS-5530", topic: "coverage", summary: "The birth center is in network. Two nights are covered after a normal delivery.", visibility: "partner", createdAt: at(-5) },
  ];
}

async function all(family: () => Promise<Family>) {
  const f = await family();
  if (!store.has(f.id)) store.set(f.id, seed(f));
  return store.get(f.id)!;
}

export const insuranceMocks = {
  ...mock("/members/{memberId}/insurance-calls", "get", async (ctx) => {
    const me = ctx.path.memberId;
    const items = (await all(ctx.family))
      .filter((c) => c.authorId === me || c.visibility === "partner" || c.visibility === "family")
      .sort((a, b) => b.calledAt.localeCompare(a.calledAt));
    return { items };
  }),
  ...mock("/members/{memberId}/insurance-calls", "post", async (ctx) => {
    const call: InsuranceCall = { ...ctx.body, id: crypto.randomUUID(), authorId: ctx.path.memberId, createdAt: new Date().toISOString() };
    (await all(ctx.family)).push(call);
    return call;
  }),
};
