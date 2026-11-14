import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { CloudOff, Lock } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import type { DiaryEntry, PsychologistAgenda, PsychologistSlots, ScreeningQuestionnaire } from "@/lib/api/types";
import { daysUntilInstant, whenWords } from "@/lib/format";
import { AgendaCard, TopicsReadyHeadline } from "@/components/care/agenda-card";
import { NextSessionTile } from "@/components/care/next-session-tile";
import { SessionNoteCard } from "@/components/care/session-note-card";
import { SlotPicker } from "@/components/care/slot-picker";
import { WellbeingLinks } from "@/components/care/wellbeing-links";
import { PageFrame, PageGrid } from "@/components/shell/page";
import { familyNow } from "@/lib/clock";

// "Care": the psychologist agenda, booking and the note after a session.
// Links to the private journal and the mood questionnaires sit under the agenda. Everything here belongs to the acting parent only.
export default function CarePage({ params }: PageProps<"/family/[memberId]/care">) {
  return (
    <Suspense fallback={<CareFallback />}>
      <Care params={params} />
    </Suspense>
  );
}

async function Care({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, { data: agenda }, { data: slots }, { data: diary }, { data: questionnaires }, recovery] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/psychologist-agenda", path),
    api.GET("/members/{memberId}/psychologist-slots", path),
    api.GET("/members/{memberId}/diary-entries", path),
    api.GET("/members/{memberId}/screening-questionnaires", path),
    // 200 only once a baby is on record (409 before), so the link never leads to an empty screen.
    api.GET("/members/{memberId}/recovery-guidance", path),
  ]);
  const parent = family?.parents.find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (family && !parent) redirect("/family");
  if (!family || !parent) notFound();

  return (
    <CareView
      memberId={memberId}
      name={parent.displayName}
      agenda={agenda}
      slots={slots}
      entries={diary?.items.filter((e) => e.authorId === memberId)}
      questionnaires={questionnaires?.items}
      recovery={recovery.response.ok && parent.role === "mother"}
      now={familyNow(family)}
    />
  );
}

type ViewProps = {
  memberId: string;
  name: string;
  agenda?: PsychologistAgenda;
  slots?: PsychologistSlots;
  entries?: DiaryEntry[];
  questionnaires?: ScreeningQuestionnaire[];
  recovery?: boolean;
  now: Date;
};

function CareView({ memberId, name, agenda, slots, entries, questionnaires, recovery, now }: ViewProps) {
  const topics = agenda?.topics ?? [];
  const next = agenda?.nextSession;
  const noteDue = agenda?.noteDue;

  let headline: React.ReactNode = <TopicsReadyHeadline memberId={memberId} topics={topics} fallback={`Pick a time with your psychologist, ${name}.`} />;
  if (noteDue) headline = `How did it go, ${name}?`;
  else if (next) headline = `Your session is ${whenWords(daysUntilInstant(next.startsAt, now))}.`;

  return (
    <PageFrame>
      <section aria-labelledby="care-headline" className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 id="care-headline" className="max-w-2xl text-headline text-balance">
            {headline}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-label font-normal text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Private to you. Your partner sees none of this.
          </p>
        </div>

        {!agenda ? (
          <Unavailable />
        ) : (
          // The session step, the agenda and the wellbeing links: two across, three on the widest screens.
          <PageGrid cols={3}>
            {noteDue ? (
              <SessionNoteCard memberId={memberId} booking={noteDue} />
            ) : next ? (
              <NextSessionTile booking={next} />
            ) : slots ? (
              <SlotPicker memberId={memberId} slots={slots} />
            ) : null}
            <AgendaCard memberId={memberId} topics={topics} />
            <WellbeingLinks memberId={memberId} entries={entries} questionnaires={questionnaires} recovery={recovery} />
          </PageGrid>
        )}
      </section>
    </PageFrame>
  );
}

function Unavailable() {
  return (
    <div role="status" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CloudOff className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-title">Your agenda and sessions are not loading</p>
        <p className="text-label text-muted-foreground">Nothing is lost. Try again in a moment.</p>
      </div>
    </div>
  );
}

function CareFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-8 h-56 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
