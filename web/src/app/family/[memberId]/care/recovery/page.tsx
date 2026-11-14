import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, Lock, NotebookPen, CalendarCheck } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { formatShortDate } from "@/lib/format";
import { StageMascot } from "@/components/illustrations";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";
import { RecoveryComposer } from "@/components/recovery/recovery-composer";
import { PainTrend, RecoveryEntries } from "@/components/recovery/recovery-entries";

// Recovery after birth: the mother's own tracker. Private to her; she may share a
// check-in with her partner, and caregivers never see any of it. The partner opens
// the same route and sees only what was shared with them.
export default function RecoveryPage({ params }: PageProps<"/family/[memberId]/care/recovery">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Recovery params={params} />
    </Suspense>
  );
}

async function Recovery({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, { data: guidance }, { data: list }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/recovery-guidance", path),
    api.GET("/members/{memberId}/recovery-checkins", path),
  ]);
  const me = family?.parents.find((p) => p.id === memberId);
  if (family && !me) redirect("/family");
  if (!family || !me) notFound();
  // No baby on record yet: nothing to recover from, back to Journal and care.
  if (!guidance) redirect(`/family/${memberId}/care`);

  const isMother = me.role === "mother";
  const other = family.parents.find((p) => p.id !== memberId);
  const items = list?.items ?? [];
  const names = new Map(family.parents.map((p) => [p.id, p.displayName]));
  const check = guidance.postnatalCheck;

  return (
    <PageFrame>
      <Rise as="header" i={0}>
        <SoftCard tone="sun" hero className="flex items-center gap-5">
          <div aria-hidden className="hidden size-28 shrink-0 sm:block md:size-36">
            <StageMascot stage="postpartum" interactive={false} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-caption tracking-[0.07em] text-ink-2 uppercase">Fourth trimester · day {guidance.daysSinceBirth}</p>
            <h1 className="mt-1 max-w-2xl text-headline text-balance">{isMother ? guidance.headline : `What ${other?.displayName ?? "she"} chose to share`}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-label font-normal text-ink-2">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              {isMother ? "Private to you. Share a check-in with your partner only if you want to." : "Only the check-ins she shared appear here."}
            </p>
          </div>
        </SoftCard>
      </Rise>

      <PageGrid cols={3}>
        <Stack className="@7xl:col-span-2">
          {isMother ? (
            <Rise i={1}>
              <RecoveryComposer memberId={memberId} partnerName={other?.displayName} />
            </Rise>
          ) : items.length === 0 ? (
            <Rise i={1}>
              <SoftCard tone="them">
                <p className="text-title">Nothing shared yet</p>
                <p className="mt-1 text-label text-ink-2">When {other?.displayName ?? "she"} shares a check-in, it shows up here. Ask how she is, in person.</p>
              </SoftCard>
            </Rise>
          ) : null}
          <Rise i={2}>
            <PainTrend items={items.filter((i) => i.authorId === memberId)} />
          </Rise>
          {items.length > 0 && (
            <Rise i={3}>
              <RecoveryEntries memberId={memberId} items={items} partnerName={other?.displayName} authorName={(id) => names.get(id) ?? "Her"} />
            </Rise>
          )}
        </Stack>

        <Stack>
          <Rise i={2}>
            <SoftCard as="section" aria-labelledby="check-title" tone="leaf" className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CalendarCheck aria-hidden className="size-5 text-leaf" />
                <h2 id="check-title" className="text-title">
                  Your checkup
                </h2>
              </div>
              <p className="text-label text-ink-2">
                Around <span className="font-mono">{formatShortDate(check.opensOn)}</span> to <span className="font-mono">{formatShortDate(check.closesOn)}</span>
                {check.status === "overdue" ? ". If you have not had it yet, it is not too late to book." : ". Ask your OB or midwife for the appointment."} ACOG says no later than{" "}
                <span className="font-mono">{formatShortDate(check.latestOn)}</span>.
              </p>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-label">
                {guidance.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <SourceLine sources={guidance.sources} />
            </SoftCard>
          </Rise>
          {isMother && (
            <Rise i={3}>
              <div className="flex flex-col gap-3">
                <Door href={`/family/${memberId}/care/journal`} icon={NotebookPen} title="Journal" hint="Write what is on your mind" />
                <Door href={`/family/${memberId}/care/screening`} icon={ClipboardCheck} title="Mood questionnaire" hint="EPDS, takes about 2 minutes" />
              </div>
            </Rise>
          )}
        </Stack>
      </PageGrid>
    </PageFrame>
  );
}

function Door({ href, icon: Icon, title, hint }: { href: string; icon: typeof NotebookPen; title: string; hint: string }) {
  return (
    <Link href={href} className="press lift flex min-h-16 items-center gap-3 rounded-3xl border border-line bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-title">{title}</span>
        <span className="block text-caption text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-40 animate-pulse rounded-[2rem] bg-muted" />
      <div className="mt-6 h-96 max-w-2xl animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
