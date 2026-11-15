"use client";

import { Popover } from "@base-ui/react/popover";
import { ArrowRight, ArrowRightLeft, Check, ChevronDown, Clock } from "lucide-react";
import { useState } from "react";
import type { Task } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { dueTone, isOffered, taskDays, daysLeftWords, toneClass } from "@/lib/tasks";
import { roleAccent, roleLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { OwnerAvatar } from "./owner";
import { useFamilyNow } from "@/components/shell/family-clock";

/** What a row needs from the screen: who is who, and the four things a person can do. */
export type TaskCtx = {
  people: Person[];
  selfId: string;
  /** Everyone a task can be offered to: the other parent, caregivers with the family plan. Never the acting person. */
  offerTargets: Person[];
  busyId: string | null;
  onToggle: (task: Task) => void;
  onOffer: (task: Task, toId: string) => void;
  onAnswer: (task: Task, accept: boolean) => void;
};

const personOf = (ctx: TaskCtx, id?: string) => ctx.people.find((p) => p.id === id);

/** The tick. A 44px target around a 24px circle; it fills with the owner's colour so done reads at a glance. */
export function DoneToggle({ task, ctx }: { task: Task; ctx: TaskCtx }) {
  const owner = personOf(ctx, task.assigneeId);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={task.done}
      aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      onClick={() => ctx.onToggle(task)}
      className="-my-2.5 -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-150",
          task.done ? cn("border-transparent text-card", owner ? roleAccent[owner.role].bg : "bg-status-ok") : "border-muted-foreground/50 bg-card hover:border-foreground",
        )}
      >
        <Check aria-hidden strokeWidth={3} className={cn("size-3.5 transition-opacity duration-150", task.done ? "opacity-100" : "opacity-0")} />
      </span>
    </button>
  );
}

/** Date in mono and the days left as a tinted chip. Nothing for an undated task. */
export function DueChip({ task, className }: { task: Task; className?: string }) {
  const now = useFamilyNow();
  const days = taskDays(task, now);
  if (!task.dueOn || days === undefined) return null;
  const tone = dueTone(task, now);
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-caption whitespace-nowrap", toneClass[tone], className)}>
      <span>{formatShortDate(task.dueOn)}</span>
      {!task.done && <span className="font-sans font-semibold">{daysLeftWords(days)}</span>}
    </span>
  );
}

/** Owner avatar; while the task is offered, the owner, an arrow and the person it is offered to (dashed). */
export function OwnerTrail({ task, ctx }: { task: Task; ctx: TaskCtx }) {
  const owner = personOf(ctx, task.assigneeId);
  const target = isOffered(task) ? personOf(ctx, task.pendingAssigneeId) : undefined;
  return (
    <span className="flex shrink-0 items-center gap-1">
      <OwnerAvatar person={owner} />
      {isOffered(task) && (
        <>
          <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
          <OwnerAvatar person={target} dashed />
        </>
      )}
    </span>
  );
}

/** Offer to the other parent in one tap, or pick from a short list when a caregiver can also take it.
 * In a row the label shows on hover or focus only, so a list is not a column of identical
 * "Hand over" words; the icon and its tooltip stay. */
export function HandOver({ task, ctx, compact = false }: { task: Task; ctx: TaskCtx; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const targets = ctx.offerTargets;
  if (targets.length === 0) return null;
  const busy = ctx.busyId === task.id;
  const trigger =
    "flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-lg text-label font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:h-9 md:px-2.5";
  const sized = compact ? "md:w-9 md:px-0" : "md:w-auto";

  if (targets.length === 1) {
    const to = targets[0];
    return (
      <button type="button" disabled={busy} onClick={() => ctx.onOffer(task, to.id)} aria-label={`Offer "${task.title}" to ${to.displayName}`} title={`Offer to ${to.displayName}`} className={cn(trigger, sized)}>
        <ArrowRightLeft aria-hidden className="size-4" />
        {!compact && <span className="hidden md:group-hover/task:inline md:group-focus-within/task:inline">Hand over</span>}
      </button>
    );
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={`Offer "${task.title}" to someone`} title="Hand over" className={cn(trigger, sized)}>
        <ArrowRightLeft aria-hidden className="size-4" />
        {!compact && <span className="hidden md:group-hover/task:inline md:group-focus-within/task:inline">Hand over</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Popover.Popup className="w-56 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
            <Popover.Title className="px-2 pt-1 pb-1.5 text-caption text-muted-foreground">They must accept before it moves</Popover.Title>
            {targets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  ctx.onOffer(task, p.id);
                }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-label outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <OwnerAvatar person={p} size="sm" />
                <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                <span className="text-caption text-muted-foreground">{roleLabel[p.role]}</span>
              </button>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The answer line under a title: Accept and Decline for the person it was offered to, a quiet wait note for the owner. */
export function OfferLine({ task, ctx }: { task: Task; ctx: TaskCtx }) {
  if (!isOffered(task)) return null;
  const owner = personOf(ctx, task.assigneeId);
  const target = personOf(ctx, task.pendingAssigneeId);
  const busy = ctx.busyId === task.id;
  if (task.pendingAssigneeId === ctx.selfId) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-label text-muted-foreground">{owner?.displayName ?? "Someone"} offered you this</span>
        <Button type="button" disabled={busy} onClick={() => ctx.onAnswer(task, true)} className="h-11 px-4 text-label md:h-9">
          Accept
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => ctx.onAnswer(task, false)} className="h-11 px-3 text-label md:h-9">
          Decline
        </Button>
      </div>
    );
  }
  return (
    <p className="mt-1 flex items-center gap-1.5 text-label text-muted-foreground">
      <Clock aria-hidden className="size-3.5" />
      Waiting for {target?.displayName ?? "an answer"} to accept
    </p>
  );
}

/** Hand-over button for the owner, when the task can still move. */
export function canHandOver(task: Task, ctx: TaskCtx) {
  return task.assigneeId === ctx.selfId && !task.done && !isOffered(task);
}

/** The extra text under a task: what to do, and a quiet source link. Only what the row does not already show. */
export function TaskDetail({ task }: { task: Task }) {
  return (
    <div className="mt-2 flex flex-col gap-1.5 text-label text-muted-foreground">
      {task.detail && <p className="max-w-prose text-body text-foreground">{task.detail}</p>}
    </div>
  );
}

export const hasDetail = (task: Task) => !!task.detail || !!task.source;

/** A title that opens its detail in place. Plain text when there is nothing to open. */
export function TaskTitle({ task, open, onToggle, id }: { task: Task; open: boolean; onToggle: () => void; id: string }) {
  const cls = cn("text-body font-medium", task.done && "text-muted-foreground line-through decoration-muted-foreground/50");
  if (!hasDetail(task)) return <p className={cls}>{task.title}</p>;
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className={cn(cls, "flex min-h-6 items-center gap-1 rounded text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}>
      {task.title}
      <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-220", open && "rotate-180")} />
    </button>
  );
}

/** One task as a row: tick, title, due chip, owner, hand over. Used by the shared plan and the bag lists. */
export function TaskRow({ task, ctx, showDue = true, compact = false }: { task: Task; ctx: TaskCtx; showDue?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const detailId = `detail-${task.id}`;
  return (
    <li id={`task-${task.id}`} className="group/task flex scroll-mt-24 items-start gap-3 py-3">
      <DoneToggle task={task} ctx={ctx} />
      <div className="min-w-0 flex-1">
        <TaskTitle task={task} open={open} onToggle={() => setOpen((o) => !o)} id={detailId} />
        {showDue && task.dueOn && (
          <div className="mt-1">
            <DueChip task={task} />
          </div>
        )}
        <OfferLine task={task} ctx={ctx} />
        {open && (
          <div id={detailId}>
            <TaskDetail task={task} />
          </div>
        )}
      </div>
      <TaskActions task={task} ctx={ctx} compact={compact} />
    </li>
  );
}

/** Hand over and the owner, in a fixed-height group so the avatar lines up with the title's first line. */
export function TaskActions({ task, ctx, compact = false }: { task: Task; ctx: TaskCtx; compact?: boolean }) {
  return (
    <div className="-mt-2.5 flex h-11 shrink-0 items-center gap-1 md:-mt-1.5 md:h-9">
      {canHandOver(task, ctx) && <HandOver task={task} ctx={ctx} compact={compact} />}
      <OwnerTrail task={task} ctx={ctx} />
    </div>
  );
}

