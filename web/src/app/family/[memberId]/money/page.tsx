import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { familyNow } from "@/lib/clock";
import { todayKey } from "@/lib/schedule";
import { BirthCostCard } from "@/components/money/birth-cost-card";
import { BudgetBoard } from "@/components/money/budget-board";
import { ChildcareCard } from "@/components/money/childcare-card";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";

// Money: one shared baby budget, a birth cost estimate and the childcare search.
// Parents only (the API answers 404 to caregivers). Reached from the Calendar,
// where the childcare deadlines also show.
export default function MoneyPage({ params }: PageProps<"/family/[memberId]/money">) {
  return (
    <Suspense fallback={<MoneyFallback />}>
      <Money params={params} />
    </Suspense>
  );
}

const DAY = 86_400_000;

async function Money({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, budget, birth, care, leave] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/budget", path),
    api.GET("/members/{memberId}/birth-cost-plan", path),
    api.GET("/members/{memberId}/childcare-options", path),
    api.GET("/members/{memberId}/leave-plan", path),
  ]);
  if (budget.response.status === 401) redirect("/");
  if (!family || !budget.data || !birth.data || !care.data) notFound();

  const parents = {
    mother: family.parents.find((p) => p.role === "mother"),
    partner: family.parents.find((p) => p.role === "partner"),
  };

  // The leave planner, when it has answers: weeks without pay become a suggested budget line.
  let leaveHint: { weeks: number; who: string } | undefined;
  for (const p of leave.data?.parents ?? []) {
    const days = p.segments.filter((s) => !s.paid).reduce((n, s) => n + (Date.parse(s.endsOn) - Date.parse(s.startsOn)) / DAY, 0);
    const weeks = Math.round(days / 7);
    if (weeks > 0 && (!leaveHint || weeks > leaveHint.weeks)) {
      leaveHint = { weeks, who: family.parents.find((x) => x.id === p.memberId)?.displayName ?? "one of you" };
    }
  }

  // After serverApi(): "today" is request time. It is the family's demo day.
  const today = todayKey(familyNow(family));

  return (
    <PageFrame>
      <Rise i={0} className="flex flex-col gap-6">
        <BudgetBoard memberId={memberId} initial={budget.data} parents={parents} leaveHint={leaveHint}>
          <BirthCostCard memberId={memberId} initial={birth.data} />
        </BudgetBoard>
      </Rise>
      <Rise i={1}>
        <ChildcareCard memberId={memberId} initial={care.data} today={today} budgetNames={budget.data.items.map((i) => i.name)} />
      </Rise>
    </PageFrame>
  );
}

function MoneyFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-56 animate-pulse rounded-[2.25rem] bg-muted" />
      <div className="mt-6 h-96 animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
