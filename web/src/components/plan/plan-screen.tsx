"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { HospitalBag, InsuranceCall, LeavePlan, Task } from "@/lib/api/types";
import { countThings } from "@/lib/format";
import type { Person } from "@/lib/roles";
import { byKind, isOffered, openFirst } from "@/lib/tasks";
import { bagIcon, insuranceIcon, leaveIcon, paperworkIcon, planIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";
import { HospitalBags } from "./hospital-bags";
import { InsuranceLog, insuranceHeadline } from "./insurance-log";
import { LeavePlanner, leaveHeadline } from "./leave-planner";
import { PaperworkTimeline } from "./paperwork-timeline";
import { TaskRow, type TaskCtx } from "./task-row";
import { useFamilyNow } from "@/components/shell/family-clock";

type Tab = "task" | "paperwork" | "hospital_bag" | "leave" | "insurance";

// One screen for every owned checklist: the shared plan, US paperwork and the
// hospital bags are all Task rows told apart by kind. Changes go to the API and
// the row updates from its answer; ownership only moves after the other person accepts.
export function PlanScreen({
  initial,
  people,
  offerTargets,
  selfId,
  leave: initialLeave,
  calls: initialCalls,
  dueOn,
}: {
  initial: Task[];
  people: Person[];
  offerTargets: Person[];
  selfId: string;
  /** Left out while the leave endpoints are not available: the tab is hidden. */
  leave?: LeavePlan;
  calls?: InsuranceCall[];
  dueOn?: string;
}) {
  const now = useFamilyNow();
  const [tasks, setTasks] = useState(initial);
  const [leave, setLeave] = useState(initialLeave);
  const [calls, setCalls] = useState(initialCalls);
  const [focusTask, setFocusTask] = useState<string>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("task");

  // A leave deadline sends you to its paperwork task: bring it into view once the tab has rendered.
  useEffect(() => {
    if (tab === "paperwork" && focusTask) document.getElementById(`task-${focusTask}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [tab, focusTask]);

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
  const tabs: { id: Tab; label: string; icon: typeof planIcon; open: number }[] = [
    { id: "task", label: "Shared plan", icon: planIcon, open: plan.filter((t) => !t.done).length },
    ...(paperwork.length ? [{ id: "paperwork" as const, label: "Paperwork", icon: paperworkIcon, open: paperwork.filter((t) => !t.done).length }] : []),
    ...(bags.length ? [{ id: "hospital_bag" as const, label: "Hospital bag", icon: bagIcon.mother, open: bags.filter((t) => !t.done).length }] : []),
  ];
  const myLeave = leave?.parents.find((p) => p.memberId === selfId);
  if (leave) tabs.push({ id: "leave", label: "Leave", icon: leaveIcon, open: myLeave?.deadlines.length ?? 0 });
  if (calls) tabs.push({ id: "insurance", label: "Insurance calls", icon: insuranceIcon, open: calls.filter((c) => c.authorId === selfId && c.followUpOn).length });
  const active = tabs.some((t) => t.id === tab) ? tab : "task";

  // The headline belongs to the open tab: it only counts that tab's tasks, so it never
  // talks about an offer or a deadline that is not on the screen. Soonest due first, undated last.
  const inTab = tasks.filter((t) => t.kind === active);
  const mine = inTab.filter((t) => t.assigneeId === selfId && !t.done).sort((x, y) => (x.dueOn ?? "9999").localeCompare(y.dueOn ?? "9999"));
  const offersToMe = inTab.filter((t) => isOffered(t) && t.pendingAssigneeId === selfId);
  const other = people.find((p) => p.id !== selfId && offersToMe.some((t) => t.assigneeId === p.id));

  const headline =
    active === "leave" && leave
      ? leaveHeadline(leave, selfId, now)
      : active === "insurance" && calls
        ? insuranceHeadline(calls, selfId, now)
        : offersToMe.length > 0
      ? `${other?.displayName ?? "Your partner"} offered you ${offersToMe.length === 1 ? "a task" : countThings(offersToMe.length).toLowerCase()}. Accept or decline below.`
      : mine.length > 0
        ? active === "hospital_bag"
          ? `${countThings(mine.length)} still to pack for you. Next: ${mine[0].title}.`
          : `${countThings(mine.length)} ${mine.length === 1 ? "is" : "are"} yours here. Next: ${mine[0].title}.`
        : active === "hospital_bag"
          ? "Your bags are packed."
          : "Nothing is waiting on you here.";
  return (
    <PageFrame>
      <h1 className="max-w-2xl text-headline text-balance print:hidden">{headline}</h1>

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Plan sections" className="print:hidden flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1 md:w-fit md:rounded-full">
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
                onClick={() => {
                  setFocusTask(undefined);
                  setTab(t.id);
                }}
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
        {active === "paperwork" && <PaperworkTimeline tasks={paperwork} ctx={ctx} highlightId={focusTask} />}
        {active === "leave" && leave && (
          <LeavePlanner
            initial={leave}
            people={people}
            selfId={selfId}
            dueOn={dueOn}
            onChange={setLeave}
            onOpenTask={(id) => {
              setFocusTask(id);
              setTab("paperwork");
            }}
          />
        )}
        {active === "insurance" && calls && <InsuranceLog calls={calls} people={people} selfId={selfId} onCreated={(c) => setCalls((all) => [...(all ?? []), c])} />}
        {active === "hospital_bag" && <HospitalBags tasks={bags} ctx={ctx} onAdd={(title, bag) => add(title, { kind: "hospital_bag", bag })} />}
      </div>
    </PageFrame>
  );
}

function SharedPlan({ tasks, ctx, offersToMe, onAdd }: { tasks: Task[]; ctx: TaskCtx; offersToMe: Task[]; onAdd: (title: string, dueOn?: string) => Promise<boolean> }) {
  const waiting = tasks.filter((t) => offersToMe.some((o) => o.id === t.id));
  const rest = openFirst(tasks.filter((t) => !waiting.includes(t)));
  const open = rest.filter((t) => !t.done);
  const done = rest.filter((t) => t.done);
  return (
    // Two columns: what is still open on the left, what is done on the right.
    <PageGrid>
      <Stack>
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
      </Stack>
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
    </PageGrid>
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
