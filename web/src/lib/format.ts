import type { Family, PlanItemStatus, Stage } from "@/lib/api/types";

// Dates from the API are plain ISO dates (YYYY-MM-DD). Format them in UTC so a
// date never shifts by a day in the visitor's time zone.
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatShortDate(isoDate: string): string {
  return shortDate.format(new Date(isoDate));
}

export function formatLongDate(isoDate: string): string {
  return longDate.format(new Date(isoDate));
}

const numberWords = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** "Two", "One", "12". */
export function countWord(n: number): string {
  return n < numberWords.length ? numberWords[n] : String(n);
}

/** "Two things", "One thing", "12 things". */
export function countThings(n: number): string {
  return `${countWord(n)} ${n === 1 ? "thing" : "things"}`;
}

export const stageLabel: Record<Stage, string> = {
  planning: "Planning",
  trying: "Trying to conceive",
  pregnancy: "Pregnancy",
  postpartum: "Newborn at home",
  infant: "First year",
  toddler: "Toddler",
  preschool: "Preschool",
  school_age: "School age",
};

/** One line under the greeting: where the family is right now. */
export function familyContext(family: Family): string {
  if (family.stage === "pregnancy" && family.gestationalWeek != null) {
    const due = family.dueDate ? ` · due ${formatShortDate(family.dueDate)}` : "";
    return `Week ${family.gestationalWeek} of pregnancy${due}`;
  }
  const child = family.children[0];
  if (child) {
    const age = child.ageMonths < 24 ? `${child.ageMonths} months` : `${Math.floor(child.ageMonths / 12)} years`;
    return `${child.name}, ${age}`;
  }
  return stageLabel[family.stage];
}

export const statusLabel: Record<PlanItemStatus, string> = {
  overdue: "Overdue",
  due: "Due",
  upcoming: "Upcoming",
};

/** Whole days from today (UTC) to an ISO date; negative when it has passed. */
export function daysUntil(isoDate: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(isoDate).getTime() - today) / 86_400_000);
}
