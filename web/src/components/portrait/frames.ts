import type { Child, Family, Portrait } from "@/lib/api/types";
import type { Drawing } from "./portrait-drawing";

/** One page of the flipbook, oldest first. */
export type Frame = {
  id: string;
  /** "Week 24", "Birth", "2 months", "4 years". */
  label: string;
  /** "Jun 2026", in mono under the label. */
  when: string;
  drawing: Drawing;
  /** Same-origin image URL for a photo; the API serves it through the session. */
  src?: string;
  /** Pixel size, for the aspect ratio of a photo. */
  width?: number;
  height?: number;
};

/** The slot the upload card offers: this month's portrait, or this week's bump photo. */
export type Slot = {
  childId?: string;
  month?: number;
  week?: number;
  /** "Leo's 2-month portrait", "Your week 25 bump photo". */
  title: string;
  /** True when a photo (not a drawing) already fills it. */
  hasPhoto: boolean;
  /** When the next one is due, as a short invitation. */
  next?: string;
};

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function childAgeLabel(month: number): string {
  if (month === 0) return "Birth";
  if (month < 24) return month === 1 ? "1 month" : `${month} months`;
  const years = Math.floor(month / 12);
  return years === 1 ? "1 year" : `${years} years`;
}

function frameOf(p: Portrait, memberId: string): Frame | undefined {
  const drawing: Drawing | undefined =
    p.month !== undefined ? { kind: "child", month: p.month } : p.week !== undefined ? { kind: "bump", week: p.week } : undefined;
  if (!drawing) return undefined;
  return {
    id: p.id,
    label: drawing.kind === "child" ? childAgeLabel(drawing.month) : `Week ${drawing.week}`,
    when: monthFmt.format(new Date(p.createdAt)),
    drawing,
    src: p.kind === "photo" ? `/api/members/${memberId}/portraits/${p.id}/image` : undefined,
    width: p.width,
    height: p.height,
  };
}

/**
 * The series to play, oldest first: the bump by week, then the child by month.
 * With childId only that child's portraits follow the bump; the bump stays,
 * because it is where every family's story starts.
 */
export function framesFor(items: Portrait[], memberId: string, childId?: string): Frame[] {
  const bump = items.filter((p) => p.childId === undefined && p.week !== undefined).sort((a, b) => a.week! - b.week!);
  const kids = items
    .filter((p) => p.childId !== undefined && p.month !== undefined && (!childId || p.childId === childId))
    .sort((a, b) => a.month! - b.month!);
  return [...bump, ...kids].map((p) => frameOf(p, memberId)).filter((f): f is Frame => f !== undefined);
}

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

function addMonths(isoDate: string, months: number): Date {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * The slot to invite into. A baby gets one portrait a month, from age two a
 * child gets one a year (on the birthday), and a pregnancy one bump photo every
 * four weeks. The copy invites and says when the next one is; it never counts
 * missed months.
 */
export function slotFor(family: Family, items: Portrait[], childId?: string): Slot | undefined {
  const child: Child | undefined = childId ? family.children.find((c) => c.id === childId) : family.children[0];
  if (child) {
    const yearly = child.ageMonths >= 24;
    const month = yearly ? Math.floor(child.ageMonths / 12) * 12 : child.ageMonths;
    const taken = items.find((p) => p.childId === child.id && p.month === month);
    const nextMonth = yearly ? month + 12 : month + 1;
    const nextDay = dayFmt.format(addMonths(child.birthDate, nextMonth));
    const ageWord = yearly ? `${month / 12}-year` : month === 0 ? "first" : `${month}-month`;
    return {
      childId: child.id,
      month,
      title: `${child.name}'s ${ageWord} portrait`,
      hasPhoto: taken?.kind === "photo",
      next: yearly
        ? `The next one is on ${child.name}'s ${ordinal(month / 12 + 1)} birthday, ${nextDay}.`
        : `${child.name} turns ${childAgeLabel(nextMonth)} on ${nextDay}. Same spot, same light?`,
    };
  }
  const week = family.gestationalWeek;
  if (family.stage !== "pregnancy" || week === undefined || week < 4 || week > 42) return undefined;
  const taken = items.find((p) => p.childId === undefined && p.week === week);
  const last = items.filter((p) => p.childId === undefined && p.week !== undefined && p.week < week).map((p) => p.week!);
  const nextWeek = (last.length ? Math.max(...last) : week) + 4;
  return {
    week,
    title: `Your week ${week} bump photo`,
    hasPhoto: taken?.kind === "photo",
    next: nextWeek > week && nextWeek <= 40 ? `One a month is plenty: the next one fits around week ${nextWeek}.` : undefined,
  };
}

/** Whose series it is, for the heading: "Leo, month by month", "Your bump, week by week". */
export function seriesTitle(family: Family, childId?: string): string {
  const child = childId ? family.children.find((c) => c.id === childId) : family.children[0];
  if (child) return child.ageMonths >= 24 ? `${child.name}, year by year` : `${child.name}, month by month`;
  return "Your bump, week by week";
}
