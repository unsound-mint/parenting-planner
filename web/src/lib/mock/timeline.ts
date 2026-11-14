import type { CalendarEvent, Family, Parent } from "@/lib/api/types";
import { dayKey, formatClock } from "@/lib/format";
import { addDays, todayKey } from "@/lib/schedule";
import { uid } from "./fixtures/dates";

// One demo timeline for every preview mock. A fixture that mentions the prenatal
// visit, the glucose test, a class or a tour takes it from here, so the calendar,
// This week, visit questions, care, tasks and the passport agree on date, time and
// owner. Days are offsets from today; clock times are Eastern, like the real seed.
//
// Demo family: Emily (mother, week 25, due 2027-02-27), Jake (partner). The real
// seed (api/internal/demo) has no calendar events yet, only the Tdap doses:
// mother due at the start of week 27 (today + 14 days), partner today + 21 days.
// The other facts here follow product.md's demo script.

export type Couple = { mother: Parent; partner: Parent };

/** Real ids and names of the demo parents, from the session's family. */
export function couple(family: Family): Couple {
  return {
    mother: family.parents.find((p) => p.role === "mother") ?? family.parents[0],
    partner: family.parents.find((p) => p.role === "partner") ?? family.parents[1] ?? family.parents[0],
  };
}

/** The UTC instant for a clock time on an Eastern calendar day ("2026-11-17", "10:30"). */
export function easternAt(day: string, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  for (const offset of [4, 5]) {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCHours(h + offset, m);
    const want = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    if (dayKey(d.toISOString()) === day && formatClock(d.toISOString()) === want) return d.toISOString();
  }
  return `${day}T${hhmm}:00Z`;
}

/** Eastern calendar day n days from today. */
export const dayOf = (n: number) => addDays(todayKey(), n);
/** UTC instant for an Eastern clock time n days from today. */
export const at = (n: number, hhmm: string) => easternAt(dayOf(n), hhmm);

type Who = "mother" | "partner";
type Spec = {
  id: string;
  kind: CalendarEvent["kind"];
  title: string;
  day: number;
  from: string;
  to?: string;
  owner?: Who;
  attendees: Who[];
  location?: string;
};

const CLINIC = "Lakeside Women's Health";

export const events = {
  prenatalVisit: { id: uid(600), kind: "appointment", title: "Prenatal visit with Dr. Reyes", day: 1, from: "09:30", to: "10:00", owner: "mother", attendees: ["mother", "partner"], location: CLINIC },
  birthClass: { id: uid(602), kind: "class", title: "Childbirth class", day: 3, from: "18:00", to: "20:00", attendees: ["mother", "partner"] },
  glucoseTest: { id: uid(603), kind: "appointment", title: "Glucose test", day: 5, from: "09:00", to: "10:00", owner: "mother", attendees: ["mother"], location: CLINIC },
  birthCenterTour: { id: uid(604), kind: "reminder", title: "Tour the birth center", day: 6, from: "17:30", to: "18:30", owner: "partner", attendees: ["mother", "partner"] },
  tdapVisit: { id: uid(605), kind: "appointment", title: "Prenatal visit with Dr. Reyes", day: 14, from: "10:00", to: "10:30", owner: "mother", attendees: ["mother"], location: CLINIC },
  anatomyScan: { id: uid(601), kind: "appointment", title: "Anatomy follow-up scan", day: 19, from: "14:00", to: "15:00", owner: "mother", attendees: ["mother"], location: CLINIC },
} satisfies Record<string, Spec>;

/** Tasks the calendar and Today also show. `n` is the task's position in the tasks fixture seed. */
export const taskPlan = {
  pediatrician: { n: 2, title: "Choose a pediatrician", day: 2, owner: "mother" },
  birthClass: { n: 1, title: "Book the newborn care class", day: 6, owner: "partner" },
} satisfies Record<string, { n: number; title: string; day: number; owner: Who }>;

/** Tdap, matching the real seed: mother at the start of week 27, partner a week later. */
export const tdap = { motherDueDay: 14, partnerDueDay: 21 };

/** The family's own care team. The psychologist is the seed's (migration 00004); the OB is not seeded yet. */
export const careTeam = {
  obstetrician: { name: "Dr. Maya Reyes", clinic: CLINIC, phone: "555-0142" },
  psychologist: { id: "7c0f3b8e-5d2a-4e61-9a43-2b8f6d1c0e57", name: "Dr. Maya Ellison (demo)", credentials: "PhD, licensed clinical psychologist", focus: "Perinatal and postpartum mental health", clinic: "Harbor Counseling" },
};

/** A previous visit that already happened, for questions carried over. */
export const lastVisit = { id: uid(609), day: -14 };

export const taskId = (familyId: string, n: number) => familyId.slice(0, 24) + n.toString(16).padStart(12, "0");

export function calendarEvent(spec: Spec, c: Couple, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  const id = (w: Who) => c[w].id;
  return {
    id: spec.id,
    kind: spec.kind,
    title: spec.title,
    startsAt: at(spec.day, spec.from),
    ...(spec.to ? { endsAt: at(spec.day, spec.to) } : {}),
    allDay: false,
    ...(spec.owner ? { ownerId: id(spec.owner) } : {}),
    attendeeIds: spec.attendees.map(id),
    visibility: "family",
    ...(spec.location ? { location: spec.location } : {}),
    ...extra,
  };
}

