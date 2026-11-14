import { Suspense } from "react";
import { Lock } from "lucide-react";
import { planningContext } from "@/lib/fertility-gate";
import { PageFrame } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { FertilityTabs } from "@/components/fertility/fertility-tabs";
import { ReadinessList } from "@/components/fertility/readiness-list";

// Getting ready together: each parent has their own checklist (appointments, vitamins,
// questions, vaccines, lifestyle). A tick is private unless shared with the partner.
export default function ReadinessPage({ params }: PageProps<"/family/[memberId]/care/fertility/readiness">) {
  return (
    <Suspense fallback={<main className="px-4 pt-6 md:px-8" aria-busy><div className="h-72 animate-pulse rounded-3xl bg-muted" /></main>}>
      <Readiness params={params} />
    </Suspense>
  );
}

async function Readiness({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { api, me, partner } = await planningContext(memberId);
  const { data } = await api.GET("/members/{memberId}/preconception-checklist", { params: { path: { memberId } } });
  const left = data ? data.total - data.done : 0;
  return (
    <PageFrame>
      <Rise i={0}>
        <FertilityTabs memberId={memberId} />
      </Rise>
      <Rise i={1}>
        <SoftCard tone="sun" hero>
          <h1 className="max-w-2xl text-headline text-balance">
            {!data ? "The checklist is not loading." : left === 0 ? "You are ready for the next step, together." : `${left} ${left === 1 ? "thing" : "things"} left to get ready, ${me.displayName}.`}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-label font-normal text-ink-2">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Your ticks are private. Share one with {partner?.displayName ?? "your partner"} when you want to.
          </p>
        </SoftCard>
      </Rise>
      {data && (
        <Rise i={2} className="max-w-3xl rounded-3xl border border-line bg-card p-5.5 md:rounded-[1.75rem] md:p-7">
          <ReadinessList memberId={memberId} initial={data} partnerName={partner?.displayName} name={me.displayName} />
        </Rise>
      )}
    </PageFrame>
  );
}
