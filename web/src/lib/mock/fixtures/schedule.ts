import { mock } from "../registry";
import { dayKey, formatClock } from "@/lib/format";
import { addDays, todayKey } from "@/lib/schedule";
import type { CalendarEvent, Shift } from "@/lib/api/types";

// Preview data for the calendar, shifts and "Baby is home" (until the Go handlers land).
// Demo family: Emily (week 25, due 2027-02-27), partner Jake. The mock cannot see the
// family, so the other parent's events use the owner key OTHER_PARENT, which the
// calendar page resolves to the parent who is not acting.
export const OTHER_PARENT = "other-parent";

/** The UTC instant for a clock time on an Eastern calendar day ("2026-11-17", "10:30"). */
function at(day: string, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  for (const offset of [4, 5]) {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCHours(h + offset, m);
    const want = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    if (dayKey(d.toISOString()) === day && formatClock(d.toISOString()) === want) return d.toISOString();
  }
  return `${day}T${hhmm}:00Z`;
}

function week(me: string): CalendarEvent[] {
  const t = todayKey();
  const day = (n: number) => addDays(t, n);
  const stored = (kind: CalendarEvent["kind"], title: string, d: string, from: string, to: string | undefined, owner: string | undefined, attendees: string[], extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: `mock-${title}-${d}`,
    kind,
    title,
    startsAt: at(d, from),
    ...(to ? { endsAt: at(d, to) } : {}),
    allDay: false,
    ...(owner ? { ownerId: owner } : {}),
    attendeeIds: attendees,
    visibility: "family",
    ...extra,
  });
  return [
    stored("appointment", "OB checkup", day(1), "10:30", "11:15", me, [me, OTHER_PARENT], { location: "Riverside Women's Health" }),
    stored("task", "Choose a pediatrician", day(2), "00:00", undefined, OTHER_PARENT, [OTHER_PARENT], { allDay: true, startsAt: `${day(2)}T00:00:00Z`, taskId: "00000000-0000-4000-8000-000000000001" }),
    stored("class", "Childbirth class", day(3), "18:00", "20:00", undefined, [me, OTHER_PARENT]),
    stored("appointment", "Glucose test", day(5), "09:00", "10:00", me, [me]),
    stored("reminder", "Tour the birth center", day(6), "17:30", "18:30", OTHER_PARENT, [me, OTHER_PARENT]),
  ];
}

export const scheduleMocks = {
  ...mock("/members/{memberId}/calendar-events", "get", (ctx) => {
    const me = ctx.path.memberId;
    const from = ctx.query.from ?? todayKey();
    const to = ctx.query.to ?? addDays(from, 6);
    const scope = ctx.query.scope ?? "family";
    const items = week(me).filter((e) => {
      const d = e.allDay ? e.startsAt.slice(0, 10) : dayKey(e.startsAt);
      if (d < from || d > to) return false;
      if (scope === "mine") return e.ownerId === me || e.attendeeIds.includes(me);
      if (scope === "partner") return e.ownerId === OTHER_PARENT;
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
