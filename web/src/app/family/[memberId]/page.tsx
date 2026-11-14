import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { countThings, familyContext } from "@/lib/format";
import { PlanBoard } from "@/components/week/plan-board";
import { MoodCheckinCard } from "@/components/week/mood-checkin-card";
import { SleepChart } from "@/components/week/sleep-chart";

// "This week": the acting parent's plan from the rules engine, the reason and
// source behind each item, and a quick mood check-in. All of it is live data.
export default function WeekPage({ params }: PageProps<"/family/[memberId]">) {
  return (
    <Suspense fallback={<WeekFallback />}>
      <Week params={params} />
    </Suspense>
  );
}

async function Week({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, { data: plan }, { data: checkins }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/plan", path),
    api.GET("/members/{memberId}/mood-checkins", path),
  ]);
  const parent = family?.parents.find((p) => p.id === memberId);
  if (!family || !parent || !plan) notFound();
  const partner = family.parents.find((p) => p.id !== memberId);
  const own = (checkins?.items ?? []).filter((c) => c.authorId === memberId);

  const overdue = plan.items.filter((i) => i.status === "overdue").length;
  const attention = overdue + plan.items.filter((i) => i.status === "due").length;
  const needs = `${countThings(attention)} ${attention === 1 ? "needs" : "need"} you this week`;
  const headline =
    attention === 0
      ? `You are on track, ${parent.displayName}. Nothing needs you this week.`
      : overdue === 0
        ? `You are on track, ${parent.displayName}. ${needs}.`
        : `${needs}, ${parent.displayName}.`;

  return (
    <main className="grid flex-1 gap-8 px-4 pt-6 pb-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="week-headline" className="min-w-0">
        <h1 id="week-headline" className="max-w-2xl text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">
          {headline}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {familyContext(family)} · built from your family&apos;s data and current guidelines
        </p>
        <PlanBoard items={plan.items} />
      </section>

      <aside className="flex flex-col gap-4 lg:pt-1">
        <SleepChart checkins={own} />
        <MoodCheckinCard memberId={memberId} partnerName={partner?.displayName} />
      </aside>
    </main>
  );
}

function WeekFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-8 h-40 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
