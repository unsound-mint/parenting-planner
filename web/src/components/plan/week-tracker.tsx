"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Task } from "@/lib/api/types";
import { daysUntil, formatShortDate } from "@/lib/format";
import type { Person } from "@/lib/roles";
import { dueTone, toneClass } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { OwnerAvatar } from "./owner";

const DAY_MS = 86_400_000;
const TERM_DAYS = 280;
const FULL_TERM = 40;
// This week and the three after it: far enough to plan a visit, near enough to act on.
const WEEKS_SHOWN = 4;

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);

/** Completed weeks of pregnancy on an ISO date, counted back from the due date (day 280). */
function weekOn(iso: string, dueOn: string): number {
  return Math.floor((TERM_DAYS + (Date.parse(iso) - Date.parse(dueOn)) / DAY_MS) / 7);
}

/** Does a card suggestion say what this task already says? Titles differ in case, trailing dots and extra words. */
function sameThing(suggestion: string, title: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const a = norm(suggestion);
  const b = norm(title);
  return a === b || a.includes(b) || b.includes(a);
}

// Where the family is now and what falls in this and the next three weeks.
// Weeks are counted from the due date and "now" is the family's demo clock, so
// the strip follows "Skip a week". Open tasks only; anything overdue sits in
// the current week with a late chip. The weekly card's to-dos for the current
// week show as suggestions only while they are not in the plan: one tap adds
// it with a due date at the end of the week, and it then shows as a plan item.
export function WeekTracker({
  tasks,
  people,
  dueOn,
  now,
  suggestions,
  onOpen,
  onAdd,
}: {
  tasks: Task[];
  people: Person[];
  dueOn: string;
  now: Date;
  /** The weekly card's tasks for the current week (getPregnancyWeek). */
  suggestions: string[];
  onOpen: (task: Task) => void;
  onAdd: (title: string, dueOn: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState<string>();
  const today = now.toISOString().slice(0, 10);
  const current = weekOn(today, dueOn);
  if (current < 4 || current > FULL_TERM) return null;
  const last = Math.min(FULL_TERM, current + WEEKS_SHOWN - 1);
  const weeks = Array.from({ length: last - current + 1 }, (_, i) => current + i);
  const start = (w: number) => addDays(dueOn, w * 7 - TERM_DAYS);
  const endOfWeek = addDays(start(current), 6);

  const open = tasks.filter((t) => !t.done && t.dueOn);
  const inWeek = (w: number) =>
    open
      .filter((t) => {
        const tw = weekOn(t.dueOn!, dueOn);
        return w === current ? tw <= current : tw === w;
      })
      .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  // Planned already: any task, done or not, so a ticked-off one is not suggested again.
  const unplanned = suggestions.filter((s) => !tasks.some((t) => sameThing(s, t.title)));

  return (
    <section aria-labelledby="tracker-title" className="rounded-2xl border border-border bg-card p-4 md:p-5 print:hidden">
      <h2 id="tracker-title" className="text-title">
        The next {weeks.length} weeks
      </h2>

      <ol className="mt-4 grid gap-4 md:grid-cols-4 md:gap-0">
        {weeks.map((w, i) => {
          const items = inWeek(w);
          const now_ = w === current;
          const cards = now_ ? unplanned : [];
          const empty = items.length + cards.length === 0;
          return (
            <li key={w} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 md:block md:pr-4" aria-current={now_ ? "step" : undefined}>
              {/* The rail: a node per week, the current one filled. On phones it runs down the left. */}
              <div className="relative flex items-start md:items-center">
                <span aria-hidden className={cn("absolute top-3 left-5 h-[calc(100%+1rem)] w-px bg-border md:top-1/2 md:left-3 md:h-px md:w-full", i === weeks.length - 1 && "hidden")} />
                <span className={cn("relative z-10 flex size-6 items-center justify-center rounded-full border-2 bg-card font-mono text-caption leading-none tabular-nums md:size-6", now_ ? "border-mom bg-mom text-card" : "border-border text-muted-foreground")}>
                  <span className="sr-only">Week </span>
                  {w}
                </span>
              </div>
              <div className="min-w-0 md:mt-3">
                <p className={cn("text-label", now_ ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {now_ ? "Now" : `In ${w - current} ${w - current === 1 ? "week" : "weeks"}`}
                  <span className="ml-2 font-mono text-caption font-normal text-muted-foreground">
                    {formatShortDate(start(w))} to {formatShortDate(addDays(start(w), 6))}
                  </span>
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {items.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(t)}
                        className="flex min-h-11 w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted md:min-h-9"
                      >
                        <OwnerAvatar person={people.find((p) => p.id === t.assigneeId)} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block line-clamp-2 text-label font-medium">{t.title}</span>
                          <span className={cn("mt-0.5 inline-block rounded-full px-1.5 font-mono text-caption", toneClass[dueTone(t, now)])}>
                            {daysUntil(t.dueOn!, now) < 0 ? `${Math.abs(daysUntil(t.dueOn!, now))} d late` : formatShortDate(t.dueOn!)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {cards.map((s) => {
                    const title = s.replace(/\.$/, "");
                    return (
                      <li key={s}>
                        <button
                          type="button"
                          disabled={adding === s}
                          onClick={async () => {
                            setAdding(s);
                            await onAdd(title, endOfWeek);
                            setAdding(undefined);
                          }}
                          className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border px-2 text-left transition-colors duration-150 hover:bg-muted disabled:opacity-60 md:min-h-9"
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
                  })}
                  {empty && <li className="px-2 text-label text-muted-foreground">Nothing planned</li>}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
