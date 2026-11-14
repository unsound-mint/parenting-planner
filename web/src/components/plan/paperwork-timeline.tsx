"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { Task } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { daysLeftWords, dueTone, openFirst, taskDays, toneDot } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { DoneToggle, DueChip, OfferLine, TaskActions, TaskDetail, TaskTitle, hasDetail, type TaskCtx } from "./task-row";
import { useFamilyNow } from "@/components/shell/family-clock";

// US paperwork as a deadline timeline, closest first. The deadlines come from
// the API (anchored to the due date or birth), so moving either moves them here.
// The next open deadline is the one highlighted card; finished ones sit at the end.
export function PaperworkTimeline({ tasks, ctx, highlightId }: { tasks: Task[]; ctx: TaskCtx; highlightId?: string }) {
  const ordered = openFirst(tasks);
  const focusId = ordered.find((t) => !t.done)?.id;
  return (
    <ol aria-label="Paperwork deadlines, closest first" className="flex max-w-3xl flex-col">
      {ordered.map((task, i) => (
        <TimelineItem key={task.id} task={task} ctx={ctx} focus={task.id === focusId} highlight={task.id === highlightId} last={i === ordered.length - 1} />
      ))}
    </ol>
  );
}

function TimelineItem({ task, ctx, focus, highlight, last }: { task: Task; ctx: TaskCtx; focus: boolean; highlight: boolean; last: boolean }) {
  const [open, setOpen] = useState((focus || highlight) && hasDetail(task));
  const now = useFamilyNow();
  const days = taskDays(task, now);
  const tone = dueTone(task, now);
  const detailId = `detail-${task.id}`;
  return (
    <li id={`task-${task.id}`} className="scroll-mt-24 grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 md:grid-cols-[5rem_1rem_minmax(0,1fr)] md:gap-x-4">
      <div className="hidden pt-4 text-right md:block">
        {task.done ? (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-status-ok-soft text-status-ok">
            <Check aria-hidden className="size-3.5" strokeWidth={3} />
            <span className="sr-only">Done</span>
          </span>
        ) : days !== undefined ? (
          <>
            <p className={cn("font-mono text-title leading-6 font-semibold", tone === "late" ? "text-status-late" : tone === "due" ? "text-status-due" : "text-foreground")}>
              {days === 0 ? "Today" : Math.abs(days)}
              <span className="sr-only"> {daysLeftWords(days)}</span>
            </p>
            {days !== 0 && (
              <p aria-hidden className="text-caption text-muted-foreground">
                {days > 0 ? (days === 1 ? "day left" : "days left") : days === -1 ? "day late" : "days late"}
              </p>
            )}
          </>
        ) : (
          <p className="text-caption text-muted-foreground">No date yet</p>
        )}
        {task.dueOn && <p className="mt-0.5 font-mono text-caption text-muted-foreground">{formatShortDate(task.dueOn)}</p>}
      </div>

      <div aria-hidden className="relative flex justify-center">
        <span className={cn("absolute top-0 w-0.5 bg-border", last ? "h-5" : "bottom-0")} />
        <span className={cn("relative z-10 mt-[22px] size-3 rounded-full ring-4 ring-background", toneDot[tone], focus && "size-4 -translate-y-0.5")} />
      </div>

      <div className={cn("mb-3 min-w-0 rounded-2xl p-3 md:p-4", focus ? "border border-primary bg-card shadow-[0_0_0_3px_var(--secondary)]" : "", highlight && !focus && "ring-2 ring-primary")}>
        <div className="flex items-start gap-3">
          <DoneToggle task={task} ctx={ctx} />
          <div className="min-w-0 flex-1">
            {focus && <p className="mb-0.5 text-caption font-semibold tracking-[0.07em] text-primary uppercase">Next deadline</p>}
            <DueChip task={task} className="mb-1 md:hidden" />
            <TaskTitle task={task} open={open} onToggle={() => setOpen((o) => !o)} id={detailId} />
            <OfferLine task={task} ctx={ctx} />
          </div>
          <TaskActions task={task} ctx={ctx} />
        </div>
        {open && (
          <div id={detailId} className="pl-[44px]">
            <TaskDetail task={task} />
          </div>
        )}
      </div>
    </li>
  );
}
