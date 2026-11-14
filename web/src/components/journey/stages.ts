import type { Family, PlanItem } from "@/lib/api/types";
import { countThings, daysUntil } from "@/lib/format";
import { familyNow } from "@/lib/clock";

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

// A due item has its window open. When the window closes far away (a vision
// check "between ages 3 and 5" ends in two years) a date or a countdown misleads,
// so it reads as due now until the end is within this many days.
const NEAR_END_DAYS = 60;

/** Days from today that a plan item should be shown at; due items with a distant end count as today. */
export function shownDays(item: PlanItem, now: Date): number {
  if (!item.dueBy) return Infinity;
  const d = daysUntil(item.dueBy, now);
  return item.status === "due" && d > NEAR_END_DAYS ? 0 : d;
}

/** The small line under an item: "Due now", "by Dec 3", "overdue" or "No set date". */
export function dueLabel(item: PlanItem, now: Date, formatDate: (iso: string) => string): string {
  if (!item.dueBy) return "No set date";
  const d = daysUntil(item.dueBy, now);
  if (d < 0) return `by ${formatDate(item.dueBy)} · overdue`;
  if (item.status === "due" && d > NEAR_END_DAYS) return "Due now";
  return `by ${formatDate(item.dueBy)}`;
}

/**
 * The stretch of coming weeks that holds this parent's next steps: long enough
 * to reach the last dated item (and the due date in late pregnancy), never
 * shorter than MIN_WEEKS or longer than MAX_WEEKS, in whole two-week steps.
 */
export function laneWindow(family: Family, items: PlanItem[]): Lane {
  const sorted = [...items].sort((a, b) => (a.dueBy ?? "9999-12-31").localeCompare(b.dueBy ?? "9999-12-31"));
  const now = familyNow(family);
  const dueDays = (i: PlanItem) => shownDays(i, now);
  const babyDays = family.stage === "pregnancy" && family.dueDate ? daysUntil(family.dueDate, now) : Infinity;

  const reach = Math.max(
    0,
    ...sorted.map(dueDays).filter((d) => d <= MAX_WEEKS * 7),
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
    inWindow: sorted.filter((i) => dueDays(i) <= days),
    later: sorted.filter((i) => dueDays(i) > days),
  };
}

/** A headline about what is next, from the family's plan. */
export function journeyHeadline(lane: Lane): string {
  const n = lane.inWindow.length;
  // Steps with no date are still waiting; "nothing to schedule" would hide them.
  const undated = lane.later.filter((i) => !i.dueBy && i.status !== "upcoming").length;
  if (n === 0 && undated > 0) return `${countThings(undated)} to do, with no date yet.`;
  const steps = n === 0 ? "Nothing to schedule" : `${countThings(n)} to do`;
  return lane.babyDue && n > 0 ? `${steps} before you meet your baby.` : `${steps} in the next ${lane.weeks} weeks.`;
}
