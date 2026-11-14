import { Suspense } from "react";
import { Lock, Share2 } from "lucide-react";
import { planningContext } from "@/lib/fertility-gate";
import { familyNow } from "@/lib/clock";
import { isoDay, flowLabel, symptomLabel, testLabel } from "@/lib/fertility";
import { formatShortDate } from "@/lib/format";
import type { FertilityEntry } from "@/lib/api/types";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { CycleHero } from "@/components/fertility/cycle-hero";
import { DailyLog } from "@/components/fertility/daily-log";
import { FertilityTabs } from "@/components/fertility/fertility-tabs";
import { NotesCard } from "@/components/fertility/notes-card";
import { TempChart } from "@/components/fertility/temp-chart";

// The fertility journal. Everything here is private to the acting parent unless an
// entry was shared with the partner. Estimates are labelled as estimates.
export default function FertilityPage({ params }: PageProps<"/family/[memberId]/care/fertility">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Fertility params={params} />
    </Suspense>
  );
}

async function Fertility({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { api, family, partner } = await planningContext(memberId);
  const path = { params: { path: { memberId } } };
  const [{ data: overview }, { data: list }] = await Promise.all([api.GET("/members/{memberId}/fertility-overview", path), api.GET("/members/{memberId}/fertility-entries", path)]);
  const today = isoDay(familyNow(family));
  const entries = list?.items ?? [];
  const mine = entries.filter((e) => e.authorId === memberId);
  const shared = entries.filter((e) => e.authorId !== memberId && e.kind !== "test" && e.kind !== "treatment_note");

  return (
    <PageFrame>
      <Rise i={0}>
        <FertilityTabs memberId={memberId} />
      </Rise>
      {overview ? (
        <Rise i={1}>
          <CycleHero overview={overview} entries={mine} today={today} />
        </Rise>
      ) : (
        <p role="status" className="text-label text-muted-foreground">The journal is not loading. Nothing is lost. Try again in a moment.</p>
      )}
      <p className="flex items-center gap-1.5 text-label font-normal text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Private to you. {partner ? `${partner.displayName} sees only what you share, item by item.` : "Nothing is shared."} Caregivers never see it, and it is never in an export.
      </p>
      <PageGrid>
        <Stack>
          <Rise i={2}>
            <DailyLog memberId={memberId} today={today} partnerName={partner?.displayName} entries={mine} mine={memberId} />
          </Rise>
          {shared.length > 0 && partner && (
            <Rise i={4}>
              <SharedByPartner name={partner.displayName} entries={shared} />
            </Rise>
          )}
        </Stack>
        <Stack>
          <Rise i={3} className="rounded-3xl border border-line bg-card p-5.5 md:rounded-[1.75rem] md:p-7">
            <h2 className="mb-4 text-title">The last four weeks</h2>
            <TempChart entries={mine} today={today} window={overview?.estimate ? { start: overview.estimate.windowStart, end: overview.estimate.windowEnd } : undefined} />
          </Rise>
          <Rise i={4}>
            <NotesCard memberId={memberId} today={today} mine={memberId} partnerName={partner?.displayName} entries={entries} />
          </Rise>
        </Stack>
      </PageGrid>
    </PageFrame>
  );
}

function describe(e: FertilityEntry): string {
  if (e.kind === "period") return `${flowLabel[e.code as keyof typeof flowLabel] ?? e.code} bleeding`;
  if (e.kind === "symptom") return symptomLabel[e.code ?? ""] ?? "Symptom";
  if (e.kind === "ovulation_test") return `Ovulation test: ${testLabel[e.code as keyof typeof testLabel] ?? e.code}`;
  return "Temperature";
}

/** The partner's shared days. Their estimate stays theirs: nothing here is predicted for them. */
function SharedByPartner({ name, entries }: { name: string; entries: FertilityEntry[] }) {
  const days = [...new Set(entries.map((e) => e.date))].sort().reverse().slice(0, 5);
  return (
    <section aria-label={`Shared by ${name}`} className="rounded-3xl bg-them-soft p-5.5 md:p-7">
      <h2 className="flex items-center gap-2 text-title">
        <Share2 className="size-5" aria-hidden />
        {name} shared with you
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {days.map((d) => (
          <li key={d} className="flex gap-3 text-label font-normal">
            <span className="w-14 shrink-0 font-mono text-caption text-muted-foreground">{formatShortDate(d)}</span>
            {entries.filter((e) => e.date === d).filter((e) => e.kind !== "bbt").map(describe).join(", ") || "Temperature"}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-10 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 h-72 animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
