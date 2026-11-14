import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { ComingUp } from "@/components/journey/coming-up";
import { JourneyTimeline } from "@/components/journey/journey-timeline";
import { JourneyHero } from "@/components/journey/journey-hero";
import { journeyFigure, journeyHeadline } from "@/components/journey/stages";

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
  const figure = journeyFigure(family);

  return (
    <main className="flex-1 px-4 pt-6 pb-16 md:px-8">
      <JourneyHero {...figure} headline={headline} support={support} />
      <div className="mt-12 max-w-5xl">
        <JourneyTimeline family={family} />
      </div>
      <ComingUp items={plan.items} weekHref={`/family/${memberId}`} />
    </main>
  );
}

function JourneyFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="size-32 animate-pulse rounded-full bg-muted md:size-40" />
      <div className="mt-12 h-40 max-w-5xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
