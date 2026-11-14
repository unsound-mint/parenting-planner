import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { familyNow } from "@/lib/clock";
import { inPlanningJournal, isoDay } from "@/lib/fertility";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { CycleRing } from "./cycle-ring";
import { cycleState } from "./cycle-hero";

/**
 * The planning stage's world on This week: where the cycle is today, and how far the
 * getting-ready checklist has come. Renders nothing for a caregiver, a family that is not
 * planning or in pregnancy loss support, or when the journal does not load.
 * Server component: place it inside <Suspense> on the This week page, in the hero slot
 * for planning and trying families. It reads the acting parent's own data only.
 */
export async function PlanningWeekCard({ memberId }: { memberId: string }) {
  let api;
  try {
    api = await serverApi();
  } catch {
    return null;
  }
  const path = { params: { path: { memberId } } };
  const { data: family } = await api.GET("/family");
  if (!family || !inPlanningJournal(family)) return null;
  const [overview, checklist, list] = await Promise.all([
    api.GET("/members/{memberId}/fertility-overview", path),
    api.GET("/members/{memberId}/preconception-checklist", path),
    api.GET("/members/{memberId}/fertility-entries", path),
  ]);
  if (!overview.data) return null;
  const partner = family.parents.find((p) => p.id !== memberId);
  const today = isoDay(familyNow(family));
  const s = cycleState(overview.data, (list.data?.items ?? []).filter((e) => e.authorId === memberId), today);
  const base = `/family/${memberId}/care/fertility`;
  const c = checklist.data;
  return (
    <Rise i={1}>
      <SoftCard tone="leaf" hero className="flex flex-col gap-6 @4xl:flex-row @4xl:items-center">
        <CycleRing length={s.length} day={s.day} periodDays={s.periodDays} window={s.win} caption={s.caption} size={190} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">Getting ready, together</p>
          <h2 className="max-w-xl text-headline text-balance">{s.headline}</h2>
          <p className="text-caption text-muted-foreground">An estimate from your own cycles, not a promise.</p>
          {c && (
            <Link href={`${base}/readiness`} className="press flex max-w-sm items-center gap-3 rounded-2xl bg-card p-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <ListChecks className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-label">
                  {c.done} of {c.total} ready{partner && c.partnerShared > 0 ? `, ${partner.displayName} shared ${c.partnerShared}` : ""}
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line">
                  <span className="block h-full origin-left rounded-full bg-me" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          )}
          <Link href={base} className="inline-flex min-h-11 items-center gap-1.5 self-start text-label font-medium underline decoration-line-2 underline-offset-3 hover:decoration-current md:min-h-9">
            Open the cycle journal
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </SoftCard>
    </Rise>
  );
}
