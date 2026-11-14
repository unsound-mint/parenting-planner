import Link from "next/link";
import { ChevronRight, Hospital } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { bagProgress } from "@/lib/hospital";

// The one-tap way in to "Going to the hospital" from This week in late
// pregnancy. Renders nothing while the birth plan is unavailable, so the page
// never links to a screen that would 404. The bag count makes it useful before
// labour: it is the reminder to pack.
export async function HospitalEntry({ memberId }: { memberId: string }) {
  let plan, tasks;
  try {
    const api = await serverApi();
    [{ data: plan }, { data: tasks }] = await Promise.all([
      api.GET("/members/{memberId}/birth-plan", { params: { path: { memberId } } }),
      api.GET("/members/{memberId}/tasks", { params: { path: { memberId }, query: { kind: "hospital_bag" } } }),
    ]);
  } catch {
    return null;
  }
  if (!plan) return null;
  const bags = tasks ? bagProgress(tasks.items) : undefined;
  return (
    <Link
      href={`/family/${memberId}/hospital`}
      className="flex min-h-16 items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors duration-150 hover:bg-muted"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-status-due-soft text-status-due">
        <Hospital className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-title">Going to the hospital</span>
        <span className="block font-mono text-caption text-muted-foreground">
          {bags && bags.total > 0 ? `${bags.done} of ${bags.total} bag items packed` : plan.hospital.name}
        </span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  );
}
