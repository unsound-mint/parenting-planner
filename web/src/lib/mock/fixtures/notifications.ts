import type { Notification } from "@/lib/api/types";
import { mock } from "../registry";
import { events, taskPlan, couple } from "../timeline";
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

async function list(memberId: string, family: () => Promise<import("@/lib/api/types").Family>) {
  let items = store.get(memberId);
  if (!items) {
    const f = await family();
    const { mother, partner } = couple(f);
    const role = f.parents.find((p) => p.id === memberId)?.role ?? "caregiver";
    items = seed(memberId, role, mother.id, partner.id);
    store.set(memberId, items);
  }
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
