"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Baby } from "lucide-react";
import type { PlanItem } from "@/lib/api/types";
import { daysUntil, formatShortDate } from "@/lib/format";
import { categoryIcon, statusBar, statusTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import type { Lane } from "./stages";
import { useFamilyNow } from "@/components/shell/family-clock";

// The next few weeks as lanes: each plan item is a bar from today to its due
// date, so the parent sees what to do and how much time is left at a glance.
// The window and ticks come from stages.ts (laneWindow); all dates are data.
export function NextWeeks({ lane, items, weekHref }: { lane: Lane; items: PlanItem[]; weekHref: string }) {
  const now = useFamilyNow();
  const at = (iso: string) => Math.min(1, Math.max(0, daysUntil(iso, now) / lane.days));
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <section aria-labelledby="next-weeks" className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="next-weeks" className="text-title">
          Your next {lane.weeks} weeks
        </h2>
        <Link href={weekHref} className="text-label text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Open this week
        </Link>
      </div>

      {/* Axis. Left edge is today; a tick every two weeks. */}
      <div className="relative mt-6 ml-0 h-6 md:ml-[38%]" aria-hidden>
        <span className="absolute top-0 left-0 -translate-x-0 text-caption font-semibold text-primary">Today</span>
        {lane.ticks.map((t, i) => (
          // Every tick gets a line, every other one a label, so labels never collide with "Today".
          <span
            key={t.days}
            className={cn("absolute top-0 -translate-x-1/2 font-mono text-caption whitespace-nowrap text-muted-foreground", i % 2 === 0 && "hidden")}
            style={{ left: pct(t.days / lane.days) }}
          >
            {t.label}
          </span>
        ))}
      </div>

      <div className="relative">
        {/* Grid lines and the baby's due date sit behind the rows, in the bar column. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-0 md:left-[38%]">
          <span className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-primary" />
          {lane.ticks.map((t) => (
            <span key={t.days} className="absolute inset-y-0 w-px bg-border" style={{ left: pct(t.days / lane.days) }} />
          ))}
          {lane.babyDue && (
            <span className="absolute inset-y-0 w-0.5 bg-mom/60" style={{ left: pct(at(lane.babyDue)) }}>
              <span className="absolute -top-1 left-1/2 flex size-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full bg-mom text-background">
                <Baby className="size-3.5" />
              </span>
            </span>
          )}
        </div>

        <ol className="relative flex flex-col gap-4 pt-3">
          {items.map((item, i) => {
            const Icon = categoryIcon[item.category];
            const days = item.dueBy ? daysUntil(item.dueBy, now) : undefined;
            const end = item.dueBy ? at(item.dueBy) : 1;
            return (
              <li key={item.ruleId} className="grid items-center gap-x-4 gap-y-2 md:grid-cols-[38%_1fr]">
                <div className="flex min-w-0 items-center gap-3 md:pr-2">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", statusTint[item.status])}>
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold">{item.title}</span>
                    <span className="block font-mono text-caption text-muted-foreground">
                      {item.dueBy ? `by ${formatShortDate(item.dueBy)}` : "No set date"}
                      {days !== undefined && days < 0 && " · overdue"}
                    </span>
                  </span>
                </div>
                <div className="relative h-9" aria-hidden>
                  <motion.span
                    className={cn("absolute top-1/2 left-0 h-3.5 origin-left -translate-y-1/2 rounded-full opacity-80", statusBar[item.status])}
                    style={{ width: pct(Math.max(end, 0.015)) }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.32, delay: 0.05 + i * 0.05 }}
                  />
                  <span
                    className={cn("absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-card", statusTint[item.status])}
                    style={{ left: pct(end) }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {items.length === 0 && (
        <p className="mt-2 text-body text-muted-foreground">Nothing to schedule in these weeks. We add steps here as your plan changes.</p>
      )}
      {lane.babyDue && (
        <p className="mt-5 flex items-center gap-2 text-caption text-muted-foreground">
          <span className="flex size-4 items-center justify-center rounded-full bg-mom text-background">
            <Baby className="size-2.5" aria-hidden />
          </span>
          Your due date, {formatShortDate(lane.babyDue)}
        </p>
      )}
    </section>
  );
}
