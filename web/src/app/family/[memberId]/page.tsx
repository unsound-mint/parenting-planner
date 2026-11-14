import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { countThings, familyContext } from "@/lib/format";
import { AiPlan } from "@/components/week/ai-plan";
import { PlanBoard } from "@/components/week/plan-board";
import { MoodPatternCard } from "@/components/week/mood-pattern-card";
import { MoodCheckinCard } from "@/components/week/mood-checkin-card";
import { BabyHome } from "@/components/baby/baby-home";
import { SleepChart } from "@/components/week/sleep-chart";

// Own check-ins needed before the sleep chart earns space in the right rail.
const MIN_SLEEP_CHECKINS = 3;

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
  // Caregivers get the baby's care and never a parent's plan or check-ins, so
  // decide who is acting before asking for any of them.
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  if (family?.caregivers?.some((c) => c.id === memberId)) return <BabyHome memberId={memberId} family={family} />;
  const [{ data: plan }, { data: checkins }, { data: patterns }] = await Promise.all([
    api.GET("/members/{memberId}/plan", path),
    api.GET("/members/{memberId}/mood-checkins", path),
    // Answers 501 until the API lands; no data means no card.
    api.GET("/members/{memberId}/mood-patterns", path),
  ]);
  const parent = family?.parents.find((p) => p.id === memberId);
  if (!family || !parent || !plan) notFound();
  const partner = family.parents.find((p) => p.id !== memberId);
  const own = (checkins?.items ?? []).filter((c) => c.authorId === memberId);

  const pattern = patterns?.items[0];

  const attention = plan.items.filter((i) => i.status !== "upcoming");
  const focus = attention[0];
  // The headline names the one thing; PlanBoard picks the same focus item.
  const headline = !focus
    ? `You are on track, ${parent.displayName}. Nothing needs you this week.`
    : attention.length === 1
      ? `One thing this week: ${focus.title}.`
      : `${countThings(attention.length)} this week. First: ${focus.title}.`;

  return (
    <main className="grid flex-1 gap-8 px-4 pt-6 pb-16 md:px-8 xl:grid-cols-[minmax(0,44rem)_minmax(0,22rem)] xl:justify-start">
      <section aria-labelledby="week-headline" className="min-w-0">
        <h1 id="week-headline" className="max-w-2xl text-headline text-balance">
          {headline}
        </h1>
        {/* The top bar shows this line from sm up; repeat it here only on phones, where the bar has no room. */}
        <p className="mt-2 text-label font-normal text-muted-foreground sm:hidden">{familyContext(family)}</p>
        <PlanBoard items={plan.items} memberId={memberId} />
        <AiPlan memberId={memberId} />
      </section>

      <aside className="flex flex-col gap-6 xl:pt-1">
        {pattern && <MoodPatternCard pattern={pattern} checkins={own} memberId={memberId} />}
        {own.length >= MIN_SLEEP_CHECKINS && <SleepChart checkins={own} />}
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
