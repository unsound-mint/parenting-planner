"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FastForward } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Plan } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { shiftedNow } from "@/lib/clock";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// Demo time: moves this family's clock a week ahead so a judge sees the plan
// change without waiting. The label stays on while the clock is shifted.
export function DemoClock({ memberId, daysAhead }: { memberId: string; daysAhead: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function skip() {
    startTransition(async () => {
      const before = await readPlan(memberId);
      const { data, error } = await api.POST("/family/demo-time-skips");
      if (error || !data) {
        toast.error("Could not skip ahead. Please try again.");
        return;
      }
      const after = await readPlan(memberId);
      const day = dateFmt.format(shiftedNow(data.demoDaysAhead ?? 0));
      const week = data.gestationalWeek === undefined ? "" : `Week ${data.gestationalWeek} of pregnancy. `;
      toast.success(`Demo time: ${day}.`, { description: week + changes(before, after) });
      router.refresh();
    });
  }

  return (
    <>
      {daysAhead > 0 && (
        <span className="order-4 inline-flex h-6 items-center rounded-full bg-status-due-soft px-2.5 font-mono text-caption font-medium text-status-due">
          Demo time +{daysAhead} days
        </span>
      )}
      <button
        type="button"
        onClick={skip}
        disabled={pending}
        className={cn(
          "order-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-label font-medium transition-colors duration-150 hover:bg-muted md:min-h-8",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
        )}
      >
        <FastForward className="size-3.5" aria-hidden />
        {pending ? "Skipping..." : "Skip a week"}
      </button>
    </>
  );
}

async function readPlan(memberId: string): Promise<Plan | undefined> {
  const { data } = await api.GET("/members/{memberId}/plan", { params: { path: { memberId } } });
  return data;
}

// What the rules engine moved: items that became due or overdue, and new ones.
function changes(before?: Plan, after?: Plan): string {
  if (!before || !after) return "Your plan and due items now use the new date.";
  const old = new Map(before.items.map((i) => [i.ruleId, i.status]));
  const moved = after.items.filter((i) => i.status !== "upcoming" && old.get(i.ruleId) !== i.status);
  if (moved.length === 0) return "No plan item changed this week.";
  const names = moved.slice(0, 3).map((i) => i.title).join(", ");
  return `Now ${moved.length === 1 ? "due" : `due or overdue (${moved.length})`}: ${names}${moved.length > 3 ? "..." : ""}`;
}
