import { mock } from "../registry";
import { dayKey } from "@/lib/format";
import { addDays, todayKey } from "@/lib/schedule";
import type { CalendarEvent, Shift } from "@/lib/api/types";
import { calendarEvent, couple, dayOf, events, taskId, taskPlan, type Couple } from "../timeline";

// Preview data for the calendar, shifts and "Baby is home" (until the Go handlers land).
// Events come from the shared demo timeline (lib/mock/timeline.ts).
function week(c: Couple, familyId: string): CalendarEvent[] {
  const task = (t: (typeof taskPlan)[keyof typeof taskPlan], familyId: string): CalendarEvent => ({
    id: `mock-task-${t.n}`,
    kind: "task",
    title: t.title,
    startsAt: `${dayOf(t.day)}T00:00:00Z`,
    allDay: true,
    ownerId: c[t.owner].id,
    attendeeIds: [c[t.owner].id],
    visibility: "family",
    taskId: taskId(familyId, t.n),
  });
  return [
    calendarEvent(events.prenatalVisit, c),
    task(taskPlan.pediatrician, familyId),
    calendarEvent(events.birthClass, c),
    calendarEvent(events.glucoseTest, c),
    calendarEvent(events.birthCenterTour, c),
    calendarEvent(events.tdapVisit, c),
    calendarEvent(events.anatomyScan, c),
  ];
}

export const scheduleMocks = {
  ...mock("/members/{memberId}/calendar-events", "get", async (ctx) => {
    const family = await ctx.family();
    const c = couple(family);
    const me = ctx.path.memberId;
    const from = ctx.query.from ?? todayKey();
    const to = ctx.query.to ?? addDays(from, 6);
    const scope = ctx.query.scope ?? "family";
    const items = week(c, family.id).filter((e) => {
      const d = e.allDay ? e.startsAt.slice(0, 10) : dayKey(e.startsAt);
      if (d < from || d > to) return false;
      if (scope === "mine") return e.ownerId === me || e.attendeeIds.includes(me);
      if (scope === "partner") return e.ownerId !== undefined && e.ownerId !== me;
      return true;
    });
    return { from, to, items };
  }),
  ...mock("/members/{memberId}/shifts", "get", (ctx) => {
    const night: Shift = {
      id: "00000000-0000-4000-8000-0000000000a1",
      memberId: ctx.path.memberId,
      title: "Night feeds",
      days: ["mon", "tue", "wed", "thu", "fri"],
      startTime: "22:00",
      endTime: "02:00",
      status: "agreed",
      createdAt: new Date().toISOString(),
    };
    return { items: [night] };
  }),
  ...mock("/members/{memberId}/shifts", "post", (ctx) => ({
    id: crypto.randomUUID(),
    memberId: ctx.path.memberId,
    title: ctx.body.title,
    days: ctx.body.days,
    startTime: ctx.body.startTime,
    endTime: ctx.body.endTime,
    status: "agreed",
    roundId: ctx.body.roundId,
    createdAt: new Date().toISOString(),
  })),
  ...mock("/members/{memberId}/baby-arrival", "post", (ctx) => ({
    id: "00000000-0000-4000-8000-0000000000f1",
    template: "pregnancy",
    stage: "postpartum",
    parents: [],
    caregivers: [],
    children: [{ id: crypto.randomUUID(), name: ctx.body.name, birthDate: ctx.body.birthDate, ageMonths: 0 }],
  })),
};
