import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { ComingUp } from "@/components/journey/coming-up";
import { JourneyTimeline } from "@/components/journey/journey-timeline";
import { journeyHeadline } from "@/components/journey/stages";

// "Journey": the path from planning to age 9 and where this family is now,
// placed from the stage, week and child age in the database.
export default function JourneyPage({ params }: PageProps<"/family/[memberId]/journey">) {
  return (
    <Suspense fallback={<JourneyFallback />}>
      <Journey params={params} />
    </Suspense>
  );
}

async function Journey({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const [{ data: family }, { data: plan }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/plan", { params: { path: { memberId } } }),
  ]);
  if (!family || !plan || !family.parents.some((p) => p.id === memberId)) notFound();
  const { headline, support } = journeyHeadline(family);

  return (
    <main className="flex-1 px-4 pt-6 pb-16 md:px-8">
      <h1 className="max-w-2xl text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">{headline}</h1>
      {support && <p className="mt-1.5 text-sm text-muted-foreground">{support}</p>}
      <div className="mt-8 max-w-5xl">
        <JourneyTimeline family={family} />
      </div>
      <ComingUp items={plan.items} weekHref={`/family/${memberId}`} />
    </main>
  );
}

function JourneyFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-8 h-40 max-w-5xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
