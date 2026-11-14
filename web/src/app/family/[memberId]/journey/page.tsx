import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyContext } from "@/lib/format";
import { formatShortDate } from "@/lib/format";
import { categoryIcon, statusTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { NextWeeks } from "@/components/journey/next-weeks";
import { PathStrip } from "@/components/journey/path-strip";
import { journeyHeadline, laneWindow } from "@/components/journey/stages";

// "Journey": the coming weeks with this parent's next steps on them, from the
// rules engine, and the whole path from planning to age 9 as small context.
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
  const lane = laneWindow(family, plan.items);
  const headline = journeyHeadline(lane);

  return (
    <main className="flex min-w-0 max-w-4xl flex-1 flex-col gap-8 px-4 pt-6 pb-16 md:px-8">
      <header className="flex flex-col gap-4">
        <PathStrip family={family} />
        <div>
          <h1 className="text-headline text-balance">{headline}</h1>
          {/* The top bar shows this line from sm up; repeat it here only on phones. */}
          <p className="mt-2 text-label font-normal text-muted-foreground sm:hidden">{familyContext(family)}</p>
        </div>
      </header>

      <NextWeeks lane={lane} items={lane.inWindow} weekHref={`/family/${memberId}`} />

      {lane.later.length > 0 && (
        <section aria-labelledby="later">
          <h2 id="later" className="text-title">
            Later
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {lane.later.map((i) => {
              const Icon = categoryIcon[i.category];
              return (
                <li key={i.ruleId} className="flex items-center gap-2.5 rounded-xl border border-border bg-card py-2 pr-4 pl-2.5">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", statusTint[i.status])}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-body font-semibold">{i.title}</span>
                    <span className="block font-mono text-caption text-muted-foreground">{i.dueBy ? `by ${formatShortDate(i.dueBy)}` : "no set date"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function JourneyFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-6 w-2/3 max-w-xl animate-pulse rounded-full bg-muted" />
      <div className="mt-6 h-9 w-1/2 animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-56 max-w-4xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
