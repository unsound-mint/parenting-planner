import type { Notification, Parent } from "@/lib/api/types";
import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { childEvents, childTaskPlan, events, olderStage, planningEvents, planningTaskPlan, taskPlan, couple, type OlderStage } from "../timeline";
import { uid } from "./dates";

// Preview data for the bell. Titles are fixed templates with names and dates
// only, like the real API's: a lab flag never says which value. State lives in
// memory per runtime (server render, browser tab); the real backend replaces it.
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const store = new Map<string, Notification[]>();

function seed(memberId: string, role: string, mother: string, partner: string): Notification[] {
  const n = (i: number, o: Omit<Notification, "id">): Notification => ({ id: uid(9000 + i), ...o });
  if (role === "mother") {
    return [
      n(1, { kind: "task_offered", title: 'Jake offered you "Call the insurer about the hospital stay"', actorId: partner, createdAt: ago(25) }),
      n(2, { kind: "value_flagged", title: "A lab result is outside the usual range", createdAt: ago(60 * 3) }),
      n(3, { kind: "appointment_reminder", title: `${events.prenatalVisit.title} is tomorrow at 9:30 AM`, createdAt: ago(60 * 5) }),
      n(4, { kind: "invitation_accepted", title: "Maria joined as your nanny", createdAt: ago(60 * 24 * 4), readAt: ago(60 * 24 * 4 - 20) }),
    ];
  }
  if (role === "partner") {
    return [
      n(11, { kind: "task_offer_answered", title: `Emily took "${taskPlan.birthClass.title}" back`, actorId: mother, createdAt: ago(80) }),
      n(12, { kind: "appointment_reminder", title: `${events.prenatalVisit.title} is tomorrow at 9:30 AM`, createdAt: ago(60 * 5) }),
      n(13, { kind: "plan_item_due", title: "Tdap vaccine is coming up in three weeks", createdAt: ago(60 * 24 * 2), readAt: ago(60 * 24 * 2 - 10) }),
    ];
  }
  return [
    n(21, { kind: "handoff_received", title: "Emily left a handoff for you", actorId: mother, createdAt: ago(45) }),
    n(22, { kind: "appointment_reminder", title: "Your shift starts tomorrow at 8:00 AM", createdAt: ago(60 * 6), readAt: ago(60 * 5) }),
  ].map((x) => ({ ...x, id: x.id + memberId.slice(-2) }));
}

// Planning and preschool: the next visit, and the task the partner offered (the second task of each seed).
function seedOlder(stage: OlderStage, role: string, mother: Parent, partner: Parent): Notification[] {
  const visit = stage === "planning" ? planningEvents.preconceptionVisit : childEvents.checkup;
  const offered = stage === "planning" ? "Ask the insurer what fertility and prenatal care it covers" : "Collect the immunization record for the kindergarten forms";
  const taken = stage === "planning" ? planningTaskPlan.budgetTalk.title : childTaskPlan.tour.title;
  const reminder = { kind: "appointment_reminder" as const, title: `${visit.title} is in ${visit.day - 1} days`, createdAt: ago(60 * 5) };
  if (role === "mother") return [{ id: uid(9101), kind: "task_offered", title: `${partner.displayName} offered you "${offered}"`, actorId: partner.id, createdAt: ago(25) }, { id: uid(9102), ...reminder }];
  if (role === "partner") return [{ id: uid(9111), kind: "task_offer_answered", title: `${mother.displayName} took "${taken}" back`, actorId: mother.id, createdAt: ago(80) }, { id: uid(9112), ...reminder }];
  return [];
}

// About the pregnancy or the baby: pregnancy loss support drops them, like the
// server deletes unread ones (the caregiver's shift reminder is not one).
const aboutPregnancy = new Set([1, 3, 11, 12, 13].map((i) => uid(9000 + i)));

async function list(memberId: string, family: () => Promise<import("@/lib/api/types").Family>) {
  const f = await family();
  let items = store.get(memberId);
  if (!items) {
    const { mother, partner } = couple(f);
    const role = f.parents.find((p) => p.id === memberId)?.role ?? "caregiver";
    const stage = olderStage(f);
    items = stage ? seedOlder(stage, role, mother, partner) : seed(memberId, role, mother.id, partner.id);
    store.set(memberId, items);
  }
  if (inLossSupport(f)) items = items.filter((i) => !aboutPregnancy.has(i.id));
  return { items, unreadCount: items.filter((i) => !i.readAt).length };
}

export const notificationMocks = {
  ...mock("/members/{memberId}/notifications", "get", (ctx) => list(ctx.path.memberId, ctx.family)),
  ...mock("/members/{memberId}/notifications/read", "post", async (ctx) => {
    const current = await list(ctx.path.memberId, ctx.family);
    const ids = ctx.body?.ids;
    const now = new Date().toISOString();
    store.set(
      ctx.path.memberId,
      current.items.map((i) => (!i.readAt && (!ids || ids.includes(i.id)) ? { ...i, readAt: now } : i)),
    );
    return list(ctx.path.memberId, ctx.family);
  }, 200),
};
