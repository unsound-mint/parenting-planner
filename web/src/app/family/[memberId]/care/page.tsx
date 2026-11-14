import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CloudOff } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { PsychologistAgenda, PsychologistSlots } from "@/lib/api/types";
import { daysUntilInstant, familyContext, whenWords } from "@/lib/format";
import { AgendaCard } from "@/components/care/agenda-card";
import { NextSessionTile } from "@/components/care/next-session-tile";
import { SessionNoteCard } from "@/components/care/session-note-card";
import { SlotPicker } from "@/components/care/slot-picker";

// "Care": the psychologist agenda, booking and the note after a session.
// The private diary joins once its endpoints land (#202). Everything here belongs to the acting parent only.
export default function CarePage({ params }: PageProps<"/family/[memberId]/care">) {
  return (
    <Suspense fallback={<CareFallback />}>
      <Care params={params} />
    </Suspense>
  );
}

async function Care({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, { data: agenda }, { data: slots }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/psychologist-agenda", path),
    api.GET("/members/{memberId}/psychologist-slots", path),
  ]);
  const parent = family?.parents.find((p) => p.id === memberId);
  if (!family || !parent) notFound();

  return (
    <CareView
      memberId={memberId}
      name={parent.displayName}
      context={familyContext(family)}
      agenda={agenda}
      slots={slots}
    />
  );
}

type ViewProps = {
  memberId: string;
  name: string;
  context: string;
  agenda?: PsychologistAgenda;
  slots?: PsychologistSlots;
};

function CareView({ memberId, name, context, agenda, slots }: ViewProps) {
  const topics = agenda?.topics ?? [];
  const next = agenda?.nextSession;
  const noteDue = agenda?.noteDue;

  let headline = `Your psychologist, ${name}. Bring what matters and pick a time.`;
  if (noteDue) headline = `How did your session with ${noteDue.provider.name} go, ${name}?`;
  else if (next) headline = `Your session with ${next.provider.name} is ${whenWords(daysUntilInstant(next.startsAt))}.`;
  else if (topics.length > 0)
    headline = `${topics.length} ${topics.length === 1 ? "topic is" : "topics are"} ready for your psychologist, ${name}. Pick a time.`;

  return (
    <main className="grid flex-1 gap-8 px-4 pt-6 pb-16 md:px-8 lg:grid-cols-[minmax(0,720px)]">
      <section aria-labelledby="care-headline" className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 id="care-headline" className="max-w-2xl text-headline text-balance">
            {headline}
          </h1>
          <p className="mt-2 text-label font-normal text-muted-foreground">{context} · private to you</p>
        </div>

        {!agenda ? (
          <Unavailable />
        ) : (
          <>
            {noteDue ? (
              <SessionNoteCard memberId={memberId} booking={noteDue} />
            ) : next ? (
              <NextSessionTile booking={next} topicCount={topics.length} />
            ) : slots ? (
              <SlotPicker memberId={memberId} slots={slots} topicCount={topics.length} />
            ) : null}
            <AgendaCard topics={topics} />
          </>
        )}
      </section>

    </main>
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
