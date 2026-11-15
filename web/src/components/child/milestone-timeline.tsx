"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, MessageCircle, Pencil, PersonStanding, Smile, Star, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Child, MilestoneDomain, RecordedMilestone } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { shiftedNow } from "@/lib/clock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const icons: Record<MilestoneDomain, LucideIcon> = {
  social_emotional: Smile,
  language_communication: MessageCircle,
  cognitive: Lightbulb,
  movement_physical: PersonStanding,
};

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "1 year 3 months", "8 months", "3 years": the child's age on a day, from ISO dates. */
function ageOn(born: string, day: string): string {
  const [by, bm, bd] = born.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  let months = (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0);
  if (months < 1) return "the first weeks";
  const years = Math.floor(months / 12);
  months %= 12;
  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  return parts.join(" ");
}

// Every milestone a parent ticked, from any checklist age, as the child's
// timeline of firsts grouped by month. A row opens in place to fix the day it
// was seen or to remove it; both parents see the same timeline. The server
// refuses a day after today or before the birth, and so do the date limits here.
export function MilestoneTimeline({ memberId, child, recorded, daysAhead }: { memberId: string; child: Child; recorded: RecordedMilestone[]; daysAhead: number }) {
  const router = useRouter();
  const [items, setItems] = useState(recorded);
  const [open, setOpen] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const today = shiftedNow(daysAhead).toISOString().slice(0, 10);
  const name = child.name.split(" ")[0];

  if (items.length === 0) return null;

  const months: { key: string; label: string; rows: RecordedMilestone[] }[] = [];
  for (const r of items) {
    const key = r.observedOn.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.rows.push(r);
    else months.push({ key, label: monthYear.format(new Date(r.observedOn)), rows: [r] });
  }

  async function save(r: RecordedMilestone, observed: boolean) {
    setBusy(true);
    const { data, error } = await api.PUT("/members/{memberId}/children/{childId}/milestones/{milestoneId}", {
      params: { path: { memberId, childId: child.id, milestoneId: r.id } },
      body: observed ? { observed, observedOn: day } : { observed },
    });
    setBusy(false);
    if (error || !data) {
      toast.error(observed ? "That day did not save. Pick a day between the birth and today." : "Could not remove it. Please try again.");
      return;
    }
    setOpen(null);
    setItems((all) =>
      observed
        ? all.map((x) => (x.id === r.id ? { ...x, observedOn: data.observedOn ?? day } : x)).sort((a, b) => b.observedOn.localeCompare(a.observedOn))
        : all.filter((x) => x.id !== r.id),
    );
    toast.success(observed ? `Moved to ${formatLongDate(day)}` : "Removed from the timeline");
    router.refresh();
  }

  return (
    <section aria-labelledby="firsts-title" className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-butter/40 text-ink-2">
          <Star className="size-4.5 fill-butter" aria-hidden />
        </span>
        <h2 id="firsts-title" className="flex-1 text-title">
          {name}&apos;s firsts
        </h2>
        <p className="font-mono text-label text-muted-foreground">
          {items.length} since {formatLongDate(items[items.length - 1].observedOn)}
        </p>
      </div>

      <ol className="mt-5 grid gap-x-10 gap-y-5 @4xl:grid-cols-2 @7xl:grid-cols-3">
        {months.map((m) => (
          <li key={m.key} className="min-w-0">
            <h3 className="text-label font-semibold text-ink-2">{m.label}</h3>
            <ul className="mt-1.5 border-l-2 border-line pl-4">
              {m.rows.map((r) => {
                const Icon = icons[r.domain];
                const editing = open === r.id;
                return (
                  <li key={r.id} className="relative">
                    <span aria-hidden className="absolute top-3.5 -left-[1.3rem] size-2.5 rounded-full bg-status-ok ring-3 ring-card" />
                    <button
                      type="button"
                      aria-expanded={editing}
                      onClick={() => {
                        setOpen(editing ? null : r.id);
                        setDay(r.observedOn);
                      }}
                      className="group flex min-h-11 w-full items-start gap-3 rounded-lg px-1 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body">{r.text}</span>
                        <span className="block font-mono text-caption text-muted-foreground">
                          {formatLongDate(r.observedOn)} · at {ageOn(child.birthDate, r.observedOn)}
                        </span>
                      </span>
                      <Pencil aria-hidden className={cn("mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100", editing && "opacity-100")} />
                    </button>
                    {editing && (
                      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3">
                        <label className="flex items-center gap-2 text-label">
                          Seen on
                          <input
                            type="date"
                            value={day}
                            min={child.birthDate}
                            max={today}
                            onChange={(e) => setDay(e.target.value)}
                            className="min-h-10 rounded-lg border border-line bg-card px-2.5 font-mono text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        </label>
                        <Button disabled={busy || !day || day === r.observedOn} onClick={() => save(r, true)}>
                          Save day
                        </Button>
                        <Button variant="ghost" disabled={busy} onClick={() => save(r, false)} className="text-muted-foreground">
                          Remove
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
