import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { FertilityLinkCard } from "@/components/fertility/fertility-link-card";
import { inPlanningJournal } from "@/lib/fertility";
import { familyNow } from "@/lib/clock";
import { PageFrame } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { JournalAndCare } from "@/components/care/journal-and-care";
import { CareTeamCard, FindHelpCard, RecoveryCard, ScreeningCard } from "@/components/care/care-rows";
import { shortName } from "@/components/care/names";
import { recommend } from "@/components/directory/recommend";
import { startersFor } from "@/components/diary/starters";

// Journal and care: the composer first, the parent's entries with per-entry
// privacy, the psychologist agenda beside them, then the care team, the mood
// questionnaire and Find help as calm rows. Everything here belongs to the
// acting parent; the partner sees only entries shared with them, and
// caregivers never open this screen (requireParent).
export default function CarePage({ params }: PageProps<"/family/[memberId]/care">) {
  return (
    <Suspense fallback={<CareFallback />}>
      <Care params={params} />
    </Suspense>
  );
}

/** "tonight", "this morning" or "today" in the families' Eastern time. */
function partOfDay(now: Date): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(now));
  if (h >= 18 || h < 4) return "tonight";
  return h < 12 ? "this morning" : "today";
}

async function Care({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, agenda, slots, diary, questionnaires, screenings, passport, providers, requests, patterns, recovery] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/psychologist-agenda", path),
    api.GET("/members/{memberId}/psychologist-slots", path),
    api.GET("/members/{memberId}/diary-entries", path),
    api.GET("/members/{memberId}/screening-questionnaires", path),
    api.GET("/members/{memberId}/mood-screenings", path),
    api.GET("/members/{memberId}/passport", path),
    api.GET("/providers"),
    api.GET("/members/{memberId}/booking-requests", path),
    api.GET("/members/{memberId}/mood-patterns", path),
    // 200 only once a baby is on record (409 before), so the card never leads to an empty screen.
    api.GET("/members/{memberId}/recovery-guidance", path),
  ]);
  const fam = family.data;
  const me = fam?.parents.find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (fam && !me) redirect("/family");
  if (!fam || !me) notFound();
  const other = fam.parents.find((p) => p.id !== memberId);
  const partner = other ? { id: other.id, name: other.displayName } : undefined;
  const now = familyNow(fam);
  const psychologist = slots.data?.provider ?? agenda.data?.nextSession?.provider;
  const team = passport.data?.people.find((p) => p.isActingParent)?.careTeam ?? [];
  const picks = recommend(providers.data?.items ?? [], patterns.data?.items[0], fam.stage).slice(0, 2).map((r) => r.provider);
  const latest = (screenings.data?.items ?? []).filter((r) => r.authorId === memberId)[0];

  return (
    <PageFrame>
      <Rise as="header" i={0}>
        <h1 className="text-headline md:text-[2.75rem] md:leading-[1.1]">Your journal</h1>
        <p className="mt-2 max-w-prose text-body text-ink-2">
          Keep the moments, and what you want to raise{psychologist ? ` with ${shortName(psychologist.name)}` : ""}. Private by default: you choose, one entry at a time,
          what {partner?.name ?? "anyone else"} sees.
        </p>
      </Rise>

      {!diary.data ? (
        <p role="status" className="rounded-3xl border border-line bg-card p-6 text-label text-muted-foreground">
          Your journal is not loading right now. Nothing is lost; try again in a moment.
        </p>
      ) : (
        <JournalAndCare
          memberId={memberId}
          name={me.displayName}
          when={partOfDay(now)}
          partner={partner}
          starters={startersFor(fam.stage, partner?.name)}
          entries={diary.data.items}
          agenda={agenda.data}
          slots={slots.data}
        />
      )}

      <Rise i={3} className="mt-4 grid min-w-0 items-start gap-6 @4xl:grid-cols-2 @7xl:grid-cols-3">
        {passport.data && <CareTeamCard memberId={memberId} team={team} />}
        {recovery.response.ok && me.role === "mother" && <RecoveryCard memberId={memberId} />}
        {questionnaires.data && <ScreeningCard memberId={memberId} latest={latest} questionnaires={questionnaires.data.items} />}
        {inPlanningJournal(fam) && <FertilityLinkCard memberId={memberId} />}
        {providers.data && <FindHelpCard memberId={memberId} picks={picks} requests={requests.data?.items ?? []} now={now} />}
      </Rise>
    </PageFrame>
  );
}

function CareFallback() {
  return (
    <main className="flex flex-col gap-6 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-11 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-6 @5xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="h-80 animate-pulse rounded-[2.25rem] bg-sun" />
        <div className="h-96 animate-pulse rounded-[1.75rem] bg-muted" />
      </div>
    </main>
  );
}
