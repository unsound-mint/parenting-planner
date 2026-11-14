"use client";

import { Plus } from "lucide-react";
import type { Task } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const TERM_DAYS = 280;
const FULL_TERM = 40;
// This week and the three after it get their own group; the rest is "Later".
const WEEKS_SHOWN = 4;

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);

/** Completed weeks of pregnancy on an ISO date, counted back from the due date (day 280). */
function weekOn(iso: string, dueOn: string): number {
  return Math.floor((TERM_DAYS + (Date.parse(iso) - Date.parse(dueOn)) / DAY_MS) / 7);
}

export type WeekGroup = {
  key: string;
  /** Pregnancy week for the dot; none for "Later". */
  week?: number;
  title: string;
  /** Mono date line under the title. */
  dates: string;
  current: boolean;
  tasks: Task[];
  /** The last day of the week, the due date given to a suggestion added here. */
  endOfWeek?: string;
};

/**
 * Open tasks grouped by the week they fall due, counted from the due date on
 * the family's demo clock, so "Skip a week" moves every group. Overdue tasks
 * sit in the current week (their chip says how late). Empty weeks are left
 * out, except the current one. Waiting offers are filtered out by the caller.
 */
export function weekGroups(open: Task[], dueOn: string, now: Date): WeekGroup[] {
  const today = now.toISOString().slice(0, 10);
  const current = weekOn(today, dueOn);
  const start = (w: number) => addDays(dueOn, w * 7 - TERM_DAYS);
  const slot = (t: Task) => (t.dueOn ? Math.max(0, weekOn(t.dueOn, dueOn) - current) : WEEKS_SHOWN);
  const byDue = (a: Task, b: Task) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999");
  const groups: WeekGroup[] = [];
  for (let i = 0; i < WEEKS_SHOWN; i++) {
    const w = current + i;
    const tasks = open.filter((t) => slot(t) === i).sort(byDue);
    if (tasks.length === 0 && i > 0) continue;
    groups.push({
      key: `w${i}`,
      week: w,
      title: i === 0 ? "This week" : i === 1 ? "Next week" : `In ${i} weeks`,
      dates: `${formatShortDate(start(w))} to ${formatShortDate(addDays(start(w), 6))}`,
      current: i === 0,
      tasks,
      endOfWeek: addDays(start(w), 6),
    });
  }
  const later = open.filter((t) => slot(t) === WEEKS_SHOWN).sort(byDue);
  if (later.length > 0) {
    groups.push({ key: "later", title: "Later", dates: `From ${formatShortDate(start(current + WEEKS_SHOWN))}`, current: false, tasks: later });
  }
  return groups;
}

/** The weekly card's to-dos are only offered for a week the card covers. */
export const hasWeeklyCard = (dueOn: string, now: Date) => {
  const w = weekOn(now.toISOString().slice(0, 10), dueOn);
  return w >= 4 && w <= FULL_TERM;
};

/** Does a card suggestion say what this task already says? Titles differ in case, trailing dots and extra words. */
function sameThing(suggestion: string, title: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const a = norm(suggestion);
  const b = norm(title);
  return a === b || a.includes(b) || b.includes(a);
}

/** Card suggestions not in the plan yet. Any task counts, done or not, so a ticked-off one is not offered again. */
export const unplannedSuggestions = (suggestions: string[], tasks: Task[]) => suggestions.filter((s) => !tasks.some((t) => sameThing(s, t.title)));

/** A group heading: the week number in a dot (the current week filled), the name, the dates. */
export function WeekHeading({ group, id }: { group: WeekGroup; id: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3">
      <span
        aria-hidden={group.week === undefined}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 font-mono text-caption leading-none tabular-nums",
          group.current ? "border-mom bg-mom text-card" : "border-border bg-card text-muted-foreground",
        )}
      >
        {group.week !== undefined ? (
          <>
            <span className="sr-only">Week </span>
            {group.week}
          </>
        ) : (
          <span className="size-1.5 rounded-full bg-muted-foreground" />
        )}
      </span>
      <span className="min-w-0">
        <span className={cn("text-title", !group.current && "text-muted-foreground")}>{group.title}</span>
        <span className="ml-2 font-mono text-caption font-normal text-muted-foreground">{group.dates}</span>
      </span>
    </h2>
  );
}

/** A weekly-card to-do that is not in the plan yet: one tap adds it, due at the end of the week. */
export function SuggestionRow({ title, busy, onAdd }: { title: string; busy: boolean; onAdd: () => void }) {
  return (
    <li className="py-2">
      <button
        type="button"
        disabled={busy}
        onClick={onAdd}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-dashed border-border px-3 text-left transition-colors duration-150 hover:bg-muted disabled:opacity-60 md:min-h-9"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-status-up-soft text-status-up">
          <Plus className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-label font-medium">{title}</span>
          <span className="block text-caption text-muted-foreground">Add to the plan</span>
        </span>
      </button>
    </li>
  );
}
