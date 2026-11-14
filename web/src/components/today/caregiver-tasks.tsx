"use client";

import { useState } from "react";
import { Check, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Task } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Tasks a grandparent or nanny with the shared to-do list can act on: what is
// offered to them (Take it / Not now) and what they already took, to tick off.
// The API only returns these with family_plan. The parent who offered sees the
// answer on Who carries what and in the plan.
export function CaregiverTasks({ memberId, tasks, names }: { memberId: string; tasks: Task[]; names: Record<string, string> }) {
  const [items, setItems] = useState(tasks);
  const [busy, setBusy] = useState<string | null>(null);
  if (items.length === 0) return null;

  async function answer(t: Task, step: "accept" | "decline") {
    setBusy(t.id);
    const { data, error } = await api.POST(`/members/{memberId}/tasks/{taskId}/reassignment/${step}`, { params: { path: { memberId, taskId: t.id } } });
    setBusy(null);
    if (error || !data) return void toast.error("Could not save that. Please try again.");
    if (step === "decline") {
      setItems((all) => all.filter((x) => x.id !== t.id));
      toast("Left with " + (names[t.assigneeId] ?? "them"));
    } else {
      setItems((all) => all.map((x) => (x.id === t.id ? data : x)));
      toast("It is yours now");
    }
  }

  async function tick(t: Task) {
    setBusy(t.id);
    const { data, error } = await api.PATCH("/members/{memberId}/tasks/{taskId}", { params: { path: { memberId, taskId: t.id } }, body: { done: true } });
    setBusy(null);
    if (error || !data) return void toast.error("Could not save that. Please try again.");
    setItems((all) => all.filter((x) => x.id !== t.id));
    toast("Done, thank you");
  }

  return (
    <section aria-labelledby="cg-tasks" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="cg-tasks" className="mb-1 flex items-center gap-2 text-title">
        <ClipboardList aria-hidden className="size-5 text-muted-foreground" />
        To do for the family
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {items.map((t) => {
          const offered = t.pendingAssigneeId === memberId;
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-label font-semibold">{t.title}</p>
                <p className={cn("text-caption", offered ? "text-ink-2" : "font-mono text-muted-foreground")}>
                  {offered ? `${names[t.assigneeId] ?? "A parent"} offered you this` : t.dueOn ? `Due ${formatShortDate(t.dueOn)}` : "Yours"}
                  {offered && t.dueOn ? `, due ${formatShortDate(t.dueOn)}` : ""}
                </p>
              </div>
              {offered ? (
                <span className="flex items-center gap-1">
                  <Button size="sm" disabled={busy === t.id} className="press min-h-11 gap-1.5 px-4" onClick={() => answer(t, "accept")}>
                    <Check aria-hidden className="size-4" />
                    Take it
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy === t.id} className="press min-h-11 px-3" onClick={() => answer(t, "decline")}>
                    Not now
                  </Button>
                </span>
              ) : (
                <Button variant="outline" size="sm" disabled={busy === t.id} className="press min-h-11 gap-1.5 px-4" onClick={() => tick(t)}>
                  <Check aria-hidden className="size-4" />
                  Mark done
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
