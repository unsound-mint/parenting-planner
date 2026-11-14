"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import type { HospitalBag, Task } from "@/lib/api/types";
import { HOSPITAL_BAGS } from "@/lib/hospital";
import { openFirst } from "@/lib/tasks";
import { bagIcon, bagLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskRow, type TaskCtx } from "./task-row";

// Three hospital bag lists, each with a progress ring. Every item shows who packs
// it (the owner avatar) and can be handed to the other parent like any task.
export function HospitalBags({ tasks, ctx, onAdd }: { tasks: Task[]; ctx: TaskCtx; onAdd: (title: string, bag: HospitalBag) => Promise<boolean> }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {HOSPITAL_BAGS.map((bag) => (
        <BagList key={bag} bag={bag} tasks={tasks.filter((t) => t.bag === bag)} ctx={ctx} onAdd={onAdd} />
      ))}
    </div>
  );
}

function BagList({ bag, tasks, ctx, onAdd }: { bag: HospitalBag; tasks: Task[]; ctx: TaskCtx; onAdd: (title: string, bag: HospitalBag) => Promise<boolean> }) {
  const Icon = bagIcon[bag];
  const done = tasks.filter((t) => t.done).length;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center gap-3">
        <ProgressRing done={done} total={tasks.length} />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="flex items-center gap-2 text-title">
            <Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
            {bagLabel[bag]}
          </h3>
          <p className="font-mono text-caption text-muted-foreground">
            {done} of {tasks.length} packed
          </p>
        </div>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {openFirst(tasks).map((t) => (
          <TaskRow key={t.id} task={t} ctx={ctx} showDue={false} compact />
        ))}
      </ul>
      <AddItem label={`Add to ${bagLabel[bag].toLowerCase()}`} onAdd={(title) => onAdd(title, bag)} />
    </section>
  );
}

/** Done over total as a ring; the figure inside repeats it for people and screen readers. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const complete = total > 0 && done === total;
  return (
    <span role="img" aria-label={`${done} of ${total} packed`} className="relative flex size-14 shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (total ? done / total : 0))}
          className={cn("transition-[stroke-dashoffset] duration-300 ease-out", complete ? "stroke-status-ok" : "stroke-primary")}
        />
      </svg>
      <span aria-hidden className="font-mono text-label font-semibold">
        {total ? Math.round((done / total) * 100) : 0}%
      </span>
    </span>
  );
}

function AddItem({ label, onAdd }: { label: string; onAdd: (title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-2 flex items-center gap-2 border-t border-border pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || busy) return;
        setBusy(true);
        if (await onAdd(title.trim())) setTitle("");
        setBusy(false);
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an item" aria-label={label} maxLength={200} className="h-11 flex-1 md:h-9" />
      <Button type="submit" variant="secondary" disabled={busy || !title.trim()} aria-label={label} className="size-11 md:size-9">
        <Plus aria-hidden />
      </Button>
    </form>
  );
}
