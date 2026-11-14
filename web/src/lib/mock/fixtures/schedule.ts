import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { dayKey } from "@/lib/format";
import { mockNow } from "@/lib/clock";
import { addDays, todayKey } from "@/lib/schedule";
import type { CalendarEvent, Shift } from "@/lib/api/types";
import { calendarEvent, couple, dayOf, events, isNewborn, newbornWeek, olderStage, olderWeek, taskId, taskPlan, type Couple } from "../timeline";

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

// The preschool family's regular childcare: who takes the child to preschool and
// who picks up. Active, so they show as the week's duties, not as agreed-for-later.
function childcare(c: Couple): Shift[] {
  const shift = (n: number, memberId: string, title: string, days: Shift["days"], startTime: string, endTime: string): Shift => ({
    id: `00000000-0000-4000-8000-0000000000b${n}`,
    memberId,
    title,
    days,
    startTime,
    endTime,
    status: "active",
    startsOn: dayOf(-30),
    createdAt: new Date().toISOString(),
  });
  return [
    shift(1, c.partner.id, "Preschool drop-off", ["mon", "tue", "wed", "thu", "fri"], "08:15", "08:45"),
    shift(2, c.mother.id, "Preschool pickup", ["mon", "tue", "thu"], "15:15", "15:45"),
    shift(3, c.partner.id, "Preschool pickup", ["wed", "fri"], "15:15", "15:45"),
  ];
}

// The newborn family splits the night: Marcus takes the first block before he is
// up for work, Aisha the second. Active, so Today and Baby show who is on duty.
function nightShifts(c: Couple): Shift[] {
  const shift = (n: number, memberId: string, startTime: string, endTime: string, days: Shift["days"]): Shift => ({
    id: `00000000-0000-4000-8000-0000000000c${n}`,
    memberId,
    title: "Night feeds",
    days,
    startTime,
    endTime,
    status: "active",
    startsOn: dayOf(-40),
    createdAt: new Date().toISOString(),
  });
  const all: Shift["days"] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return [
    shift(1, c.partner.id, "21:30", "01:30", all),
    shift(2, c.mother.id, "01:30", "06:00", all),
  ];
}

export const scheduleMocks = {
  ...mock("/members/{memberId}/calendar-events", "get", async (ctx) => {
    const family = await ctx.family();
    const c = couple(family);
    const me = ctx.path.memberId;
    const from = ctx.query.from ?? todayKey(mockNow());
    const to = ctx.query.to ?? addDays(from, 6);
    const scope = ctx.query.scope ?? "family";
    // The demo week is all pregnancy: visits, classes, the tour and baby-prep tasks.
    // Pregnancy loss support shows none of it.
    const stage = olderStage(family);
    const all = inLossSupport(family) ? [] : stage ? olderWeek(stage, c, family.id) : isNewborn(family) ? newbornWeek(c, family.id) : week(c, family.id);
    const items = all.filter((e) => {
      const d = e.allDay ? e.startsAt.slice(0, 10) : dayKey(e.startsAt);
      if (d < from || d > to) return false;
      if (scope === "mine") return e.ownerId === me || e.attendeeIds.includes(me);
      if (scope === "partner") return e.ownerId !== undefined && e.ownerId !== me;
      return true;
    });
    return { from, to, items };
  }),
  ...mock("/members/{memberId}/shifts", "get", async (ctx) => {
    const family = await ctx.family();
    // Agreed shifts wait for the baby, so pregnancy loss support hides them (the API keeps them).
    if (inLossSupport(family)) return { items: [] };
    const stage = olderStage(family);
    if (stage === "planning") return { items: [] };
    if (stage === "child") return { items: childcare(couple(family)) };
    if (isNewborn(family)) return { items: nightShifts(couple(family)) };
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
