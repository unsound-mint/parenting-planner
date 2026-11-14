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
// Empty in pregnancy loss support: no week, no due date, and not "Planning" either.
export function familyContext(family: Family): string {
  if (family.pregnancyLoss) return "";
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
export function daysUntil(isoDate: string, now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(isoDate).getTime() - today) / 86_400_000);
}

// Session times are real instants. Families are in the US (api/internal/httpapi
// server.go), so show Eastern time; a fixed zone also keeps server and browser
// renders identical.
const ZONE = "America/New_York";
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: ZONE });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: ZONE });
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: ZONE });
const dayNumFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: ZONE });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE });

/** "10:30 AM" in Eastern time. */
export const formatClock = (iso: string) => timeFmt.format(new Date(iso));
export const formatWeekday = (iso: string) => weekdayFmt.format(new Date(iso));
export const formatMonth = (iso: string) => monthFmt.format(new Date(iso));
export const formatDayNumber = (iso: string) => dayNumFmt.format(new Date(iso));
/** "2026-11-17": groups instants by calendar day in Eastern time. */
export const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));

/** Whole calendar days from today to an instant, in Eastern time. */
export function daysUntilInstant(iso: string, now: Date): number {
  return Math.round((Date.parse(dayKey(iso)) - Date.parse(dayKey(now.toISOString()))) / 86_400_000);
}

/** "today", "tomorrow", "in 3 days". */
export function whenWords(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

/** The first sentence of a longer guideline text: the one-line action for a card. */
export function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}
