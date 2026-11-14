import { mock } from "../registry";

// Preview data for the care log, handoffs and the baby card. Times are relative
// to now so "last fed 95 minutes ago" always reads right. Writes are echoed, not
// stored: a mock cannot share state between the server render and the browser.
const min = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const ME = "00000000-0000-4000-8000-000000000001";
const CHILD = "00000000-0000-4000-8000-0000000000c1";

function entries() {
  const e = (kind: "feed" | "sleep" | "diaper", ago: number, extra: Record<string, unknown> = {}, dur?: number) => ({
    id: `00000000-0000-4000-8000-${String(Math.round(ago)).padStart(12, "0")}`,
    childId: CHILD,
    authorId: ME,
    kind,
    startedAt: min(ago),
    endedAt: dur ? min(ago - dur) : undefined,
    createdAt: min(ago),
    ...extra,
  });
  return [
    e("sleep", 70, {}, 40),
    e("feed", 95, { feedMethod: "breast_right" as const }),
    e("diaper", 120, { diaper: "dirty" as const }),
    e("sleep", 330, {}, 90),
    e("diaper", 300, { diaper: "both" as const }),
    e("feed", 250, { feedMethod: "bottle_breast_milk" as const, amountMl: 80 }),
    e("feed", 430, { feedMethod: "bottle_formula" as const, amountMl: 90 }),
    e("sleep", 520, {}, 70),
    e("diaper", 560, { diaper: "wet" as const }),
    e("feed", 600, { feedMethod: "breast_left" as const }),
  ];
}

export const babyMocks = {
  ...mock("/members/{memberId}/care-log", "get", (ctx) => {
    const items = entries();
    const last = (k: string) => items.find((i) => i.kind === k);
    return {
      items,
      latest: {
        lastFeed: last("feed"),
        lastSleep: last("sleep"),
        lastDiaper: last("diaper"),
        onDuty: { memberId: ctx.path.memberId, since: min(300), via: "shift" as const },
      },
    };
  }),
  ...mock("/members/{memberId}/care-log", "post", (ctx) => ({
    id: crypto.randomUUID(),
    childId: ctx.body.childId ?? CHILD,
    authorId: ctx.path.memberId,
    kind: ctx.body.kind,
    startedAt: ctx.body.startedAt,
    endedAt: ctx.body.endedAt,
    feedMethod: ctx.body.feedMethod,
    amountMl: ctx.body.amountMl,
    diaper: ctx.body.diaper,
    note: ctx.body.note,
    createdAt: new Date().toISOString(),
  })),
  ...mock("/members/{memberId}/handoffs", "get", () => ({ items: [] })),
  ...mock("/members/{memberId}/handoffs", "post", (ctx) => ({
    id: crypto.randomUUID(),
    fromMemberId: ctx.path.memberId,
    toMemberId: ctx.body.toMemberId,
    note: ctx.body.note,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    careSummary: {},
  })),
  ...mock("/members/{memberId}/children/{childId}/passport", "get", (ctx) => ({
    child: { id: ctx.path.childId, name: "Leo", birthDate: "2026-09-26", ageMonths: 1 },
    limitedView: false,
    pediatrician: { id: "00000000-0000-4000-8000-0000000000d1", name: "Dr. Maya Reyes", role: "pediatrician" as const, clinic: "Riverside Pediatrics", phone: "(555) 010-2244" },
    allergies: [
      { id: "00000000-0000-4000-8000-0000000000a1", substance: "Egg", certainty: "suspected" as const, reaction: "Rash after the first taste", visibility: "family" as const },
      { id: "00000000-0000-4000-8000-0000000000a2", substance: "Penicillin", certainty: "confirmed" as const, visibility: "family" as const },
    ],
    emergencyContacts: [{ name: "Grandma Linda", relation: "Grandmother", phone: "(555) 010-9981" }],
    medicalHistory: [],
    vaccines: [
      { id: "00000000-0000-4000-8000-0000000000b1", name: "HepB", dose: "Dose 1 of 3", status: "done" as const, givenOn: "2026-09-27", visibility: "family" as const },
      { id: "00000000-0000-4000-8000-0000000000b2", name: "HepB", dose: "Dose 2 of 3", status: "due" as const, dueOn: "2026-11-10", visibility: "family" as const },
    ],
  })),
};
