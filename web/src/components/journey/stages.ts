import type { Family, PlanItem, Stage } from "@/lib/api/types";
import { countThings, daysUntil, formatShortDate } from "@/lib/format";

// The path from planning to age 9. "Birth" is a milestone between Pregnancy
// and Newborn, so it has a node but no API stage of its own.
export type JourneyNode = { key: string; label: string };

export const journeyNodes: JourneyNode[] = [
  { key: "planning", label: "Planning" },
  { key: "pregnancy", label: "Pregnancy" },
  { key: "birth", label: "Birth" },
  { key: "newborn", label: "Newborn" },
  { key: "first-year", label: "First year" },
  { key: "toddler", label: "Toddler" },
  { key: "preschool", label: "Preschool" },
  { key: "school-age", label: "School age" },
];

export const nodeIndex: Record<Stage, number> = {
  planning: 0,
  trying: 0,
  pregnancy: 1,
  postpartum: 3,
  infant: 4,
  toddler: 5,
  preschool: 6,
  school_age: 7,
};

const MIN_WEEKS = 6;
const MAX_WEEKS = 16;

export type Lane = {
  weeks: number;
  days: number;
  /** A tick every two weeks: days from today and a plain relative label ("in 4 wk"). */
  ticks: { days: number; label: string }[];
  /** The baby's due date when it falls inside the window. */
  babyDue?: string;
  /** Items due inside the window (or overdue), soonest first. */
  inWindow: PlanItem[];
  /** Items due after the window or with no date. */
  later: PlanItem[];
};

/**
 * The stretch of coming weeks that holds this parent's next steps: long enough
 * to reach the last dated item (and the due date in late pregnancy), never
 * shorter than MIN_WEEKS or longer than MAX_WEEKS, in whole two-week steps.
 */
export function laneWindow(family: Family, items: PlanItem[]): Lane {
  const sorted = [...items].sort((a, b) => (a.dueBy ?? "9999-12-31").localeCompare(b.dueBy ?? "9999-12-31"));
  const dueDays = (d?: string) => (d ? daysUntil(d) : Infinity);
  const babyDays = family.stage === "pregnancy" && family.dueDate ? daysUntil(family.dueDate) : Infinity;

  const reach = Math.max(
    0,
    ...sorted.map((i) => dueDays(i.dueBy)).filter((d) => d <= MAX_WEEKS * 7),
    babyDays <= MAX_WEEKS * 7 ? babyDays : 0,
  );
  const weeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.ceil((reach + 7) / 14) * 2));
  const days = weeks * 7;

  const ticks: Lane["ticks"] = [];
  for (let d = 14; d < days; d += 14) {
    ticks.push({ days: d, label: `in ${d / 7} wk` });
  }

  return {
    weeks,
    days,
    ticks,
    babyDue: babyDays >= 0 && babyDays <= days ? family.dueDate : undefined,
    inWindow: sorted.filter((i) => dueDays(i.dueBy) <= days),
    later: sorted.filter((i) => dueDays(i.dueBy) > days),
  };
}

/** A headline about what is next and a short line of context, from the family's data. */
export function journeyHeadline(family: Family, lane: Lane): { headline: string; support: string } {
  const n = lane.inWindow.length;
  const steps = n === 0 ? "Nothing to schedule" : `${countThings(n)} to do`;
  const headline = lane.babyDue && n > 0 ? `${steps} before you meet your baby.` : `${steps} in the next ${lane.weeks} weeks.`;

  const child = family.children[0];
  let support = "";
  if (family.stage === "pregnancy" && family.gestationalWeek != null) {
    support = `Week ${family.gestationalWeek} of pregnancy${family.dueDate ? ` · due ${formatShortDate(family.dueDate)}` : ""}`;
  } else if (child) {
    support = `${child.name}, ${child.ageMonths} months old`;
  } else if (family.stage === "planning") {
    support = "Planning for a baby";
  } else if (family.stage === "trying") {
    support = "Trying for a baby";
  }
  return { headline, support };
}
