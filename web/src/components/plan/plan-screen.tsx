"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { HospitalBag, Task } from "@/lib/api/types";
import { countThings } from "@/lib/format";
import type { Person } from "@/lib/roles";
import { byKind, isOffered, openFirst } from "@/lib/tasks";
import { bagIcon, paperworkIcon, planIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HospitalBags } from "./hospital-bags";
import { PaperworkTimeline } from "./paperwork-timeline";
import { TaskRow, type TaskCtx } from "./task-row";

type Tab = "task" | "paperwork" | "hospital_bag";

// One screen for every owned checklist: the shared plan, US paperwork and the
// hospital bags are all Task rows told apart by kind. Changes go to the API and
// the row updates from its answer; ownership only moves after the other person accepts.
export function PlanScreen({
  initial,
  people,
  offerTargets,
  selfId,
}: {
  initial: Task[];
  people: Person[];
  offerTargets: Person[];
  selfId: string;
}) {
  const [tasks, setTasks] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("task");

  const replace = (t: Task) => setTasks((all) => all.map((x) => (x.id === t.id ? t : x)));

  async function onToggle(task: Task) {
    const next = { ...task, done: !task.done };
    replace(next);
    const { data, error } = await api.PATCH("/members/{memberId}/tasks/{taskId}", {
      params: { path: { memberId: selfId, taskId: task.id } },
      body: { done: next.done },
    });
    if (error || !data) {
      replace(task);
      toast.error("Could not save that. Please try again.");
      return;
    }
    replace(data);
  }

  async function onOffer(task: Task, toId: string) {
    setBusyId(task.id);
    const { data, error } = await api.POST("/members/{memberId}/tasks/{taskId}/reassignment", {
      params: { path: { memberId: selfId, taskId: task.id } },
      body: { toMemberId: toId },
    });
    setBusyId(null);
    if (error || !data) {
      toast.error("Could not offer that. Please try again.");
      return;
    }
    replace(data);
    const to = people.find((p) => p.id === toId);
    toast(`Offered to ${to?.displayName ?? "them"}`, { description: "It stays with you until they accept." });
  }

  async function onAnswer(task: Task, accept: boolean) {
    setBusyId(task.id);
    const { data, error } = await api.POST(
      accept ? "/members/{memberId}/tasks/{taskId}/reassignment/accept" : "/members/{memberId}/tasks/{taskId}/reassignment/decline",
      { params: { path: { memberId: selfId, taskId: task.id } } },
    );
    setBusyId(null);
    if (error || !data) {
      toast.error("Could not save your answer. Please try again.");
      return;
    }
    replace(data);
    toast(accept ? "It is yours now" : "Declined. It stays with them.");
  }

  async function add(title: string, extra: { kind?: "task" | "hospital_bag"; bag?: HospitalBag; dueOn?: string }): Promise<boolean> {
    const { data, error } = await api.POST("/members/{memberId}/tasks", {
      params: { path: { memberId: selfId } },
      body: { title, ...extra },
    });
    if (error || !data) {
      toast.error("Could not add that. Please try again.");
      return false;
    }
    setTasks((all) => [...all, data]);
    return true;
  }

  const ctx: TaskCtx = { people, selfId, offerTargets, busyId, onToggle, onOffer, onAnswer };
  const plan = byKind(tasks, "task");
  const paperwork = byKind(tasks, "paperwork");
  const bags = byKind(tasks, "hospital_bag");
  // Bag items have no deadline; the sentence counts plan and paperwork, soonest due first, undated last.
  const mine = tasks
    .filter((t) => t.assigneeId === selfId && !t.done && t.kind !== "hospital_bag")
    .sort((x, y) => (x.dueOn ?? "9999").localeCompare(y.dueOn ?? "9999"));
  const offersToMe = tasks.filter((t) => isOffered(t) && t.pendingAssigneeId === selfId);
  const other = people.find((p) => p.id !== selfId && offersToMe.some((t) => t.assigneeId === p.id));

  const headline =
    offersToMe.length > 0
      ? `${other?.displayName ?? "Your partner"} offered you ${offersToMe.length === 1 ? "a task" : countThings(offersToMe.length).toLowerCase()}. Accept or decline below.`
      : mine.length > 0
        ? `${countThings(mine.length)} ${mine.length === 1 ? "is" : "are"} yours. Next: ${mine[0].title}.`
        : "Nothing is waiting on you.";

  const tabs: { id: Tab; label: string; icon: typeof planIcon; open: number }[] = [
    { id: "task", label: "Shared plan", icon: planIcon, open: plan.filter((t) => !t.done).length },
    ...(paperwork.length ? [{ id: "paperwork" as const, label: "Paperwork", icon: paperworkIcon, open: paperwork.filter((t) => !t.done).length }] : []),
    ...(bags.length ? [{ id: "hospital_bag" as const, label: "Hospital bag", icon: bagIcon.mother, open: bags.filter((t) => !t.done).length }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : "task";

  return (
    <main className="flex min-w-0 max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 pb-16 md:px-8">
      <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Plan sections" className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1 md:w-fit md:rounded-full">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 sm:px-3 text-label font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9 md:flex-none md:rounded-full md:px-4",
                  on ? "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <t.icon aria-hidden className="hidden size-4 sm:block" />
                {t.label}
                {t.open > 0 && <span className="rounded-full bg-secondary px-1.5 font-mono text-caption text-secondary-foreground">{t.open}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="min-w-0">
        {active === "task" && <SharedPlan tasks={plan} ctx={ctx} offersToMe={offersToMe} onAdd={(title, dueOn) => add(title, { dueOn })} />}
        {active === "paperwork" && <PaperworkTimeline tasks={paperwork} ctx={ctx} />}
        {active === "hospital_bag" && <HospitalBags tasks={bags} ctx={ctx} onAdd={(title, bag) => add(title, { kind: "hospital_bag", bag })} />}
      </div>
    </main>
  );
}

function SharedPlan({ tasks, ctx, offersToMe, onAdd }: { tasks: Task[]; ctx: TaskCtx; offersToMe: Task[]; onAdd: (title: string, dueOn?: string) => Promise<boolean> }) {
  const waiting = tasks.filter((t) => offersToMe.some((o) => o.id === t.id));
  const rest = openFirst(tasks.filter((t) => !waiting.includes(t)));
  const open = rest.filter((t) => !t.done);
  const done = rest.filter((t) => t.done);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {waiting.length > 0 && (
        <section aria-labelledby="waiting-title">
          <h2 id="waiting-title" className="text-title">
            Waiting for your answer
          </h2>
          <ul className="mt-1 divide-y divide-border">
            {waiting.map((t) => (
              <TaskRow key={t.id} task={t} ctx={ctx} />
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="open-title">
        <h2 id="open-title" className="text-title">
          Open
        </h2>
        {open.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">Nothing open. Add the next thing below.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} ctx={ctx} />
            ))}
          </ul>
        )}
        <AddTask onAdd={onAdd} />
      </section>
      {done.length > 0 && (
        <section aria-labelledby="done-title">
          <h2 id="done-title" className="text-title text-muted-foreground">
            Done
          </h2>
          <ul className="mt-1 divide-y divide-border">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} ctx={ctx} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AddTask({ onAdd }: { onAdd: (title: string, dueOn?: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || busy) return;
        setBusy(true);
        if (await onAdd(title.trim(), dueOn || undefined)) {
          setTitle("");
          setDueOn("");
        }
        setBusy(false);
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for you" aria-label="New task" maxLength={200} className="h-11 min-w-48 flex-1 md:h-9" />
      <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label="Due date, optional" className="h-11 w-auto font-mono md:h-9" />
      <Button type="submit" disabled={busy || !title.trim()} className="h-11 px-4 text-label md:h-9">
        <Plus aria-hidden />
        Add
      </Button>
    </form>
  );
}
