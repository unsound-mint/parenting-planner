import type { CalendarEvent, Family, Parent } from "@/lib/api/types";
import { dayKey, formatClock } from "@/lib/format";
import { addDays, todayKey } from "@/lib/schedule";
import { mockNow, shiftedNow } from "@/lib/clock";
import { uid } from "./fixtures/dates";

// One demo timeline for every preview mock. A fixture that mentions the prenatal
// visit, the glucose test, a class or a tour takes it from here, so the calendar,
// This week, visit questions, care, tasks and the passport agree on date, time and
// owner. Days are offsets from today; clock times are Eastern, like the real seed.
//
// Demo family: Emily (mother, week 25, due 2027-02-27), Jake (partner). The real
// seed (api/internal/demo) has no calendar events yet, only the Tdap doses:
// mother due at the start of week 27 (today + 14 days), partner today + 21 days.
// The care team is the seed's: Dr. Priya Shah at Riverbend Women's Health (OB) and
// Riverbend Women's Hospital in Austin. A mock must not name another doctor for
// a role the real passport already answers. The other facts here follow
// product.md's demo script.

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
export const dayOf = (n: number) => addDays(todayKey(mockNow()), n);
/** UTC instant for an Eastern clock time n days from today. */
export const at = (n: number, hhmm: string) => easternAt(dayOf(n), hhmm);

/**
 * Like at(), but fixed to the real calendar: "Skip a week" moves the family clock
 * past it instead of dragging it along. The real seed stores appointments at fixed
 * dates too, so after a skip the visit is behind you and the after-visit view shows.
 */
const atFixed = (n: number, hhmm: string) => easternAt(addDays(todayKey(shiftedNow(0)), n), hhmm);

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

const CLINIC = "Riverbend Women's Health";

export const events = {
  prenatalVisit: { id: uid(600), kind: "appointment", title: "Prenatal visit with Dr. Shah", day: 1, from: "09:30", to: "10:00", owner: "mother", attendees: ["mother", "partner"], location: CLINIC },
  birthClass: { id: uid(602), kind: "class", title: "Childbirth class", day: 3, from: "18:00", to: "20:00", attendees: ["mother", "partner"] },
  glucoseTest: { id: uid(603), kind: "appointment", title: "Glucose test", day: 5, from: "09:00", to: "10:00", owner: "mother", attendees: ["mother"], location: CLINIC },
  birthCenterTour: { id: uid(604), kind: "reminder", title: "Tour the birth center", day: 6, from: "17:30", to: "18:30", owner: "partner", attendees: ["mother", "partner"] },
  tdapVisit: { id: uid(605), kind: "appointment", title: "Prenatal visit with Dr. Shah", day: 14, from: "10:00", to: "10:30", owner: "mother", attendees: ["mother"], location: CLINIC },
  anatomyScan: { id: uid(601), kind: "appointment", title: "Anatomy follow-up scan", day: 19, from: "14:00", to: "15:00", owner: "mother", attendees: ["mother"], location: CLINIC },
} satisfies Record<string, Spec>;

// Older stages. The real seed (api/internal/demo/families.go) gives the planning
// family Maya and Daniel (Dr. Okafor, obstetrician; Dr. Brooks, primary care at
// Cedar Park Family Medicine) and the preschool family Rachel and Tom with Ava,
// 4 (Dr. Rahman, Foothills Children's Clinic). Their calendars and plans follow
// these two sets, never the pregnancy family's.
export type OlderStage = "planning" | "child";

/** Which older-stage mock set a family gets; undefined for pregnancy, newborn and anything else. */
export function olderStage(family: Pick<Family, "stage">): OlderStage | undefined {
  if (family.stage === "planning" || family.stage === "trying") return "planning";
  if (family.stage === "toddler" || family.stage === "preschool" || family.stage === "school_age") return "child";
  return undefined;
}

const BROOKS = "Cedar Park Family Medicine";
const FOOTHILLS = "Foothills Children's Clinic";

export const planningEvents = {
  mmrShot: { id: uid(630), kind: "appointment", title: "MMR shot with Dr. Brooks", day: 2, from: "08:30", to: "09:00", owner: "mother", attendees: ["mother"], location: BROOKS },
  budgetTalk: { id: uid(631), kind: "reminder", title: "Talk about budget, leave and who does what", day: 4, from: "19:30", to: "20:30", owner: "partner", attendees: ["mother", "partner"] },
  preconceptionVisit: { id: uid(632), kind: "appointment", title: "Preconception visit with Dr. Okafor", day: 9, from: "10:00", to: "10:45", owner: "mother", attendees: ["mother", "partner"] },
} satisfies Record<string, Spec>;

export const childEvents = {
  parentEvening: { id: uid(635), kind: "class", title: "Parent evening at preschool", day: 3, from: "18:00", to: "19:00", attendees: ["mother", "partner"] },
  checkup: { id: uid(636), kind: "appointment", title: "4-year check-up with Dr. Rahman", day: 5, from: "09:00", to: "09:45", owner: "mother", attendees: ["mother"], location: FOOTHILLS },
  schoolTour: { id: uid(637), kind: "reminder", title: "Tour Aspen Hill Elementary", day: 8, from: "16:30", to: "17:30", owner: "partner", attendees: ["mother", "partner"] },
} satisfies Record<string, Spec>;

type TaskSpec = { n: number; title: string; day: number; owner: Who };
export const planningTaskPlan = {
  budgetTalk: { n: 5, title: planningEvents.budgetTalk.title, day: 4, owner: "partner" },
  history: { n: 1, title: "Write down your family health history", day: 6, owner: "mother" },
} satisfies Record<string, TaskSpec>;
export const childTaskPlan = {
  cutoff: { n: 1, title: "Check the kindergarten cutoff date for your state", day: 3, owner: "mother" },
  tour: { n: 2, title: childEvents.schoolTour.title, day: 8, owner: "partner" },
} satisfies Record<string, TaskSpec>;

/** The calendar and Today of an older-stage family, in day order. */
export function olderWeek(stage: OlderStage, c: Couple, familyId: string): CalendarEvent[] {
  const task = (t: TaskSpec): CalendarEvent => ({
    id: `mock-task-${stage}-${t.n}`,
    kind: "task",
    title: t.title,
    startsAt: `${dayOf(t.day)}T00:00:00Z`,
    allDay: true,
    ownerId: c[t.owner].id,
    attendeeIds: [c[t.owner].id],
    visibility: "family",
    taskId: taskId(familyId, t.n),
  });
  return stage === "planning"
    ? [calendarEvent(planningEvents.mmrShot, c), calendarEvent(planningEvents.budgetTalk, c), task(planningTaskPlan.history), calendarEvent(planningEvents.preconceptionVisit, c)]
    : [calendarEvent(childEvents.parentEvening, c), task(childTaskPlan.cutoff), calendarEvent(childEvents.checkup, c), calendarEvent(childEvents.schoolTour, c)];
}


// Newborn family. The real seed (api/internal/demo/families.go, seedNewborn) gives
// Aisha (mother) and Marcus (partner) with Leo, born 49 days ago, so 7 weeks old:
// Dr. Lena Park (OB), Dr. Samuel Ortiz (pediatrician, Harborview Pediatrics),
// Grace Whitfield (lactation) and Bayside Birth Center, all in Boston. Leo has
// had hepatitis B at birth; the 2-month doses are scheduled for his 2-month day.
// The rules engine already answers This week's plan items (own checkup, 2-month
// vaccines, Marcus's mood questionnaire), so nothing here repeats them.
export const newbornTeam = {
  obstetrician: { name: "Dr. Lena Park", phone: "(617) 555-0133" },
  pediatrician: { name: "Dr. Samuel Ortiz", clinic: "Harborview Pediatrics, Boston, MA", phone: "(617) 555-0164" },
  lactation: { name: "Grace Whitfield, IBCLC", phone: "(617) 555-0190" },
  birthClinic: { name: "Bayside Birth Center", city: "Boston, MA" },
};

/** Postpartum and infant families get the newborn mock set. */
export function isNewborn(family: Pick<Family, "stage">): boolean {
  return family.stage === "postpartum" || family.stage === "infant";
}

/** The OB of the family: the pregnancy seed's doctor until the birth, Dr. Park for the newborn seed. */
export function obstetricianOf(family: Pick<Family, "template">) {
  return family.template === "pregnancy" ? careTeam.obstetrician : newbornTeam.obstetrician;
}

/** Leo's own age in whole weeks, from the real child of the session's family. */
export function babyWeeks(family: Pick<Family, "children">): number {
  const born = family.children[0]?.birthDate;
  return born ? Math.max(0, Math.floor((Date.parse(dayOf(0)) - Date.parse(born)) / (7 * 86_400_000))) : 7;
}

/** Midnight-based date n days after Leo's birth (his 2-month day is the seed's dose date). */
export function afterBirth(family: Pick<Family, "children">, months: number): string {
  const born = family.children[0]?.birthDate ?? dayOf(-49);
  const d = new Date(`${born}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const newbornEvents = {
  weightCheck: { id: uid(650), kind: "appointment", title: "Weight check with Dr. Ortiz", day: 2, from: "09:00", to: "09:30", owner: "mother", attendees: ["mother"], location: "Harborview Pediatrics" },
  lactationVisit: { id: uid(651), kind: "appointment", title: "Feeding visit with Grace Whitfield", day: 4, from: "10:30", to: "11:15", owner: "mother", attendees: ["mother"], location: "Harborview Pediatrics" },
} satisfies Record<string, Spec>;

export const newbornTaskPlan = {
  carSeat: { n: 2, title: "Check the car seat straps and recline", day: 4, owner: "partner" },
  pumping: { n: 1, title: "Ask HR about a pumping space and your return date", day: 6, owner: "mother" },
} satisfies Record<string, TaskSpec>;

/** The calendar and Today of a newborn family, in day order. */
export function newbornWeek(c: Couple, familyId: string): CalendarEvent[] {
  const task = (t: TaskSpec): CalendarEvent => ({
    id: `mock-task-newborn-${t.n}`,
    kind: "task",
    title: t.title,
    startsAt: `${dayOf(t.day)}T00:00:00Z`,
    allDay: true,
    ownerId: c[t.owner].id,
    attendeeIds: [c[t.owner].id],
    visibility: "family",
    taskId: taskId(familyId, t.n),
  });
  // The active night shifts of the shifts fixture, as the real feed lists them: Marcus first, Aisha after 1:30.
  const nights = Array.from({ length: 21 }, (_, i) => i - 7).flatMap((day): CalendarEvent[] =>
    (["partner", "mother"] as const).map((who) => ({
      id: `mock-shift-newborn-${who}-${day}`,
      kind: "shift",
      title: "Night feeds",
      startsAt: at(who === "partner" ? day : day + 1, who === "partner" ? "21:30" : "01:30"),
      endsAt: at(day + 1, who === "partner" ? "01:30" : "06:00"),
      allDay: false,
      ownerId: c[who].id,
      attendeeIds: [c[who].id],
      visibility: "family",
    })),
  );
  return [calendarEvent(newbornEvents.weightCheck, c), task(newbornTaskPlan.carSeat), calendarEvent(newbornEvents.lactationVisit, c), task(newbornTaskPlan.pumping), ...nights];
}

/** Tasks the calendar and Today also show. `n` is the task's position in the tasks fixture seed. */
export const taskPlan = {
  pediatrician: { n: 2, title: "Choose a pediatrician", day: 2, owner: "mother" },
  birthClass: { n: 1, title: "Book the newborn care class", day: 6, owner: "partner" },
} satisfies Record<string, { n: number; title: string; day: number; owner: Who }>;

/** Tdap, matching the real seed: mother at the start of week 27, partner a week later. */
export const tdap = { motherDueDay: 14, partnerDueDay: 21 };

/** The pregnancy family's care team, as seeded (api/internal/demo/demo.go). The psychologist is the seed's (migration 00004). */
export const careTeam = {
  obstetrician: { name: "Dr. Priya Shah", clinic: CLINIC, phone: "(512) 555-0142" },
  psychologist: { id: "7c0f3b8e-5d2a-4e61-9a43-2b8f6d1c0e57", name: "Dr. Maya Ellison (demo)", credentials: "PhD, licensed clinical psychologist", focus: "Perinatal and postpartum mental health", clinic: "Harbor Counseling" },
};

/** Where the family plans to give birth: the seed's birth clinic (name and city only). The phone numbers and the drive are made up. */
export const birthHospital = {
  name: "Riverbend Women's Hospital",
  address: "Riverbend Women's Hospital, Austin, TX",
  phone: "(512) 555-0188",
  deskPhone: "(512) 555-0190",
  travelMinutes: 22,
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
    startsAt: (spec.kind === "appointment" ? atFixed : at)(spec.day, spec.from),
    ...(spec.to ? { endsAt: (spec.kind === "appointment" ? atFixed : at)(spec.day, spec.to) } : {}),
    allDay: false,
    ...(spec.owner ? { ownerId: id(spec.owner) } : {}),
    attendeeIds: spec.attendees.map(id),
    visibility: "family",
    ...(spec.location ? { location: spec.location } : {}),
    ...extra,
  };
}

