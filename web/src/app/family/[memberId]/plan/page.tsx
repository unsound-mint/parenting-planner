import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { PlanScreen } from "@/components/plan/plan-screen";

// "Plan": the family's owned tasks in one place. The shared plan, US paperwork
// and the hospital bags are all tasks (one model, told apart by kind). These are
// not the guideline items on This week, which come from the rules engine.
export default function PlanPage({ params }: PageProps<"/family/[memberId]/plan">) {
  return (
    <Suspense fallback={<PlanFallback />}>
      <Plan params={params} />
    </Suspense>
  );
}

async function Plan({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const [{ data: family }, { data: tasks }, { data: leave }, { data: calls }] = await Promise.all([
    api.GET("/family"),
    // 501 until the backend lands: no data, no screen (the nav entry is hidden too).
    api.GET("/members/{memberId}/tasks", { params: { path: { memberId } } }),
    // Leave and insurance calls are extra tabs: when they are not available the tab is simply not offered.
    api.GET("/members/{memberId}/leave-plan", { params: { path: { memberId } } }),
    api.GET("/members/{memberId}/insurance-calls", { params: { path: { memberId } } }),
  ]);
  const people = family ? familyPeople(family) : [];
  const self = people.find((p) => p.id === memberId);
  if (!family || !self || isCaregiver(self.role) || !tasks) notFound();

  // The leave planner counts toward a birth; pregnancy loss support hides its tab.
  // Who a task can be offered to: the other parent, and caregivers who may use the family plan.
  const offerTargets = people.filter(
    (p) => p.id !== memberId && (!isCaregiver(p.role) || family.caregivers?.find((c) => c.id === p.id)?.permissions.includes("family_plan")),
  );

  return <PlanScreen initial={tasks.items} people={people} offerTargets={offerTargets} selfId={memberId} leave={family.pregnancyLoss ? undefined : leave} calls={calls?.items} dueOn={family.dueDate} />;
}

function PlanFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-9 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 h-9 w-72 animate-pulse rounded-full bg-muted" />
      <div className="mt-8 h-56 max-w-3xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
