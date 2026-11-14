import type { Task } from "@/lib/api/types";
import { daysUntil } from "@/lib/format";

// Helpers for the Plan screen. The API sorts tasks soonest due first, undated
// last; these keep that order and only add presentation.

export type DueTone = "ok" | "late" | "due" | "up" | "none";

/** Whole days to the due date, negative once passed; undefined without a date. */
export function taskDays(task: Task): number | undefined {
  return task.dueOn ? daysUntil(task.dueOn) : undefined;
}

/** Window in days where a deadline reads as "due" (ochre) instead of "upcoming". */
const DUE_SOON_DAYS = 14;

export function dueTone(task: Task): DueTone {
  if (task.done) return "ok";
  const days = taskDays(task);
  if (days === undefined) return "none";
  if (days < 0) return "late";
  return days <= DUE_SOON_DAYS ? "due" : "up";
}

/** Tint for the chip and the timeline node (status tokens, overdue is clay). */
export const toneClass: Record<DueTone, string> = {
  ok: "bg-status-ok-soft text-status-ok",
  late: "bg-status-late-soft text-status-late",
  due: "bg-status-due-soft text-status-due",
  up: "bg-status-up-soft text-status-up",
  none: "bg-muted text-muted-foreground",
};

export const toneDot: Record<DueTone, string> = {
  ok: "bg-status-ok",
  late: "bg-status-late",
  due: "bg-status-due",
  up: "bg-status-up",
  none: "bg-border",
};

/** "today", "1 day left", "12 days left", "3 days late". */
export function daysLeftWords(days: number): string {
  if (days === 0) return "today";
  const n = Math.abs(days);
  const unit = n === 1 ? "day" : "days";
  return days > 0 ? `${n} ${unit} left` : `${n} ${unit} late`;
}

/** Open tasks first in the API's order, finished ones after. */
export function openFirst(tasks: Task[]): Task[] {
  return [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)];
}

export function byKind(tasks: Task[], kind: Task["kind"]): Task[] {
  return tasks.filter((t) => t.kind === kind);
}

/** True while the task is offered to someone and waiting for their answer. */
export function isOffered(task: Task): boolean {
  return !!task.pendingAssigneeId && !task.done;
}
