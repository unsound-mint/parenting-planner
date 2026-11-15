"use client";

import { useState } from "react";
import { Check, Lightbulb, MessageCircle, PersonStanding, Smile, Sprout, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Milestone, MilestoneChecklist, MilestoneDomain } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The CDC names its lists "by 2 months", "by 1 year", "by 30 months", "by 4 years". */
function ageLabel(months: number): string {
  if (months === 12) return "1 year";
  return months % 12 === 0 ? `${months / 12} years` : `${months} months`;
}

const domains: { id: MilestoneDomain; label: string; icon: LucideIcon }[] = [
  { id: "social_emotional", label: "Social and emotional", icon: Smile },
  { id: "language_communication", label: "Talking", icon: MessageCircle },
  { id: "cognitive", label: "Thinking", icon: Lightbulb },
  { id: "movement_physical", label: "Movement", icon: PersonStanding },
];

// The CDC checklist for the child's age. A parent ticks what they have seen. An
// unticked line is never called a delay: it only means "watch for it and bring it
// to the next check-up". The CDC page is linked in the closing sentence.
export function MilestoneCard({ memberId, childId, checklist }: { memberId: string; childId: string; checklist: MilestoneChecklist }) {
  const [items, setItems] = useState(checklist.items);
  const seen = items.filter((m) => m.observed).length;
  const age = ageLabel(checklist.checklistAgeMonths);

  async function toggle(m: Milestone) {
    const next = { ...m, observed: !m.observed };
    setItems((all) => all.map((x) => (x.id === m.id ? next : x)));
    const { data, error } = await api.PUT("/members/{memberId}/children/{childId}/milestones/{milestoneId}", {
      params: { path: { memberId, childId, milestoneId: m.id } },
      body: { observed: next.observed },
    });
    if (error || !data) {
      setItems((all) => all.map((x) => (x.id === m.id ? m : x)));
      toast.error("Could not save that. Please try again.");
      return;
    }
    setItems((all) => all.map((x) => (x.id === m.id ? data : x)));
  }

  return (
    <section aria-labelledby="milestones-title" className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-up-soft text-status-up">
          <Sprout className="size-4.5" aria-hidden />
        </span>
        <h2 id="milestones-title" className="flex-1 text-title">
          What most children do by {age}
        </h2>
        <p className="font-mono text-label text-muted-foreground">
          {seen} of {items.length} seen
        </p>
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-6 lg:grid-cols-2">
        {domains.map((d) => {
          const rows = items.filter((m) => m.domain === d.id);
          const n = rows.filter((m) => m.observed).length;
          return (
            <div key={d.id} className="min-w-0">
              <div className="flex items-center gap-2">
                <d.icon aria-hidden className="size-4 text-muted-foreground" />
                <h3 className="flex-1 text-label font-semibold">{d.label}</h3>
                <span className="font-mono text-caption text-muted-foreground">
                  {n}/{rows.length}
                </span>
              </div>
              <div role="presentation" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-status-ok transition-[width] duration-300" style={{ width: `${(n / rows.length) * 100}%` }} />
              </div>
              <ul className="mt-2">
                {rows.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      aria-pressed={m.observed}
                      onClick={() => toggle(m)}
                      className="group flex min-h-11 w-full items-start gap-3 rounded-lg px-1 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
                          m.observed ? "border-status-ok bg-status-ok text-card" : "border-border group-hover:border-muted-foreground",
                        )}
                      >
                        {m.observed && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className={cn("flex-1 text-body", m.observed && "text-muted-foreground")}>{m.text}</span>
                      {m.observed && m.observedOn && <span className="mt-0.5 font-mono text-caption whitespace-nowrap text-muted-foreground">{formatShortDate(m.observedOn)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-5 border-t border-border pt-4 text-label text-muted-foreground">
        Bring the ones you have not seen to the next check-up. Children get there at their own pace, and this is not a diagnosis.
      </p>
    </section>
  );
}
