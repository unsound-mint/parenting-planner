import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, FileText, MapPin, MessageCircleQuestion, NotebookPen, Route } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { daysUntilInstant, formatClock, formatLongDate, whenWords, dayKey } from "@/lib/format";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { familyNow } from "@/lib/clock";
import { PageFrame, PageGrid } from "@/components/shell/page";
import { VisitQuestions } from "@/components/week/visit-prep";
import { Question } from "@/components/week/appointment-questions-card";
import { NextStep, VisitNote } from "@/components/week/visit-after";
import { cn } from "@/lib/utils";

// Prep for one visit: when to leave, what to bring and what to ask. Questions
// added any time wait here (carried over from earlier visits if unanswered).
// Once the visit has started on the family clock, the same page becomes the
// after-visit view: answers, a private note and one next step.
export default function AppointmentPage({ params }: PageProps<"/family/[memberId]/appointments/[appointmentId]">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Appointment params={params} />
    </Suspense>
  );
}

async function Appointment({ params }: { params: Promise<{ memberId: string; appointmentId: string }> }) {
  const { memberId, appointmentId } = await params;
  const api = await serverApi();
  const [{ data: family }, { data: prep }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/appointments/{appointmentId}/prep", { params: { path: { memberId, appointmentId } } }),
  ]);
  const self = family && familyPeople(family).find((p) => p.id === memberId);
  if (!family || !self || isCaregiver(self.role) || !prep) notFound();
  const partner = family.parents.find((p) => p.id !== memberId);
  const { appointment, travel, documents, questions, note } = prep;
  const now = familyNow(family);
  const days = daysUntilInstant(appointment.startsAt, now);
  const open = questions.filter((q) => !q.answered).length;
  const passed = now.getTime() >= Date.parse(appointment.startsAt);
  // Prenatal visits are about four weeks apart in the middle of pregnancy.
  const suggestedDate = new Date(Date.parse(dayKey(appointment.startsAt)) + 28 * 86_400_000).toISOString().slice(0, 10);

  return (
    <PageFrame>
      <header>
        <Link href={`/family/${memberId}`} className="inline-flex min-h-11 items-center gap-1.5 text-label text-muted-foreground hover:text-foreground md:min-h-0">
          <ArrowLeft className="size-4" aria-hidden />
          This week
        </Link>
        {passed && <p className="mt-3 text-label font-medium text-status-ok">After the visit</p>}
        <h1 className="mt-1 max-w-2xl text-headline text-balance">{appointment.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-label font-normal text-muted-foreground">
          <span className="flex items-center gap-1.5 font-mono">
            <Clock className="size-4" aria-hidden />
            {days === 0 || (days > 0 && days <= 1) ? `${whenWords(days)}, ` : days === -1 ? "yesterday, " : `${formatLongDate(dayKey(appointment.startsAt))}, `}
            {formatClock(appointment.startsAt)}
          </span>
          {appointment.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {appointment.location}
            </span>
          )}
        </p>
      </header>

      {passed ? (
        <PageGrid cols={3}>
          <section aria-labelledby="answers-title" className="rounded-2xl border border-border bg-card p-5 @4xl:col-span-2 @7xl:col-span-1">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="answers-title" className="flex items-center gap-2 text-title">
                <MessageCircleQuestion className="size-4.5 text-muted-foreground" aria-hidden />
                Your questions
              </h2>
              {questions.length > 0 && <span className="font-mono text-caption text-muted-foreground">{open === 0 ? "all answered" : `${questions.length - open} of ${questions.length} answered`}</span>}
            </div>
            {questions.length > 0 ? (
              <ul className="flex flex-col">
                {questions.map((q) => (
                  <Question key={q.id} q={q} memberId={memberId} after />
                ))}
              </ul>
            ) : (
              <p className="text-label text-muted-foreground">You did not write any questions for this visit.</p>
            )}
          </section>
          <section aria-labelledby="note-title" className="rounded-2xl border border-border bg-card p-5">
            <h2 id="note-title" className="mb-3 flex items-center gap-2 text-title">
              <NotebookPen className="size-4.5 text-muted-foreground" aria-hidden />
              Your note
            </h2>
            <VisitNote memberId={memberId} appointmentId={appointmentId} note={note} />
          </section>
          <section aria-labelledby="next-title" className="rounded-2xl border border-border bg-card p-5">
            <h2 id="next-title" className="mb-3 flex items-center gap-2 text-title">
              <Route className="size-4.5 text-muted-foreground" aria-hidden />
              What is next
            </h2>
            <NextStep memberId={memberId} appointment={appointment} suggestedDate={suggestedDate} />
          </section>
        </PageGrid>
      ) : (
      <PageGrid cols={3}>
        {travel && (
          <section aria-labelledby="leave-title" className="rounded-2xl border border-border bg-card p-5">
            <h2 id="leave-title" className="text-label font-medium text-muted-foreground">
              Leave by
            </h2>
            <p className="mt-1 font-mono text-display">{formatClock(travel.leaveBy)}</p>
            <p className="text-label font-normal text-muted-foreground">{travel.minutes} min including a 10 min buffer</p>
            {travel.mapsUrl && (
              <a href={travel.mapsUrl} target="_blank" rel="noreferrer" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-secondary text-label font-semibold text-secondary-foreground transition-colors duration-150 hover:bg-muted">
                Open the route
              </a>
            )}
          </section>
        )}

        <section aria-labelledby="bring-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="bring-title" className="flex items-center gap-2 text-title">
            <FileText className="size-4.5 text-muted-foreground" aria-hidden />
            Bring
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {documents.map((d) => (
              <li key={d.title} className="flex items-start gap-3 py-2.5">
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", d.ready ? "bg-status-ok text-primary-foreground" : "border-2 border-border")}>
                  {d.ready && <Check className="size-3" strokeWidth={3} aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-label font-semibold">
                    {d.title}
                    <span className="sr-only">{d.ready ? ", ready" : ", not ready"}</span>
                  </span>
                  {d.detail && <span className="block text-caption text-muted-foreground">{d.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ask-title" className="rounded-2xl border border-border bg-card p-5 @4xl:col-span-2 @7xl:col-span-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="ask-title" className="flex items-center gap-2 text-title">
              <MessageCircleQuestion className="size-4.5 text-muted-foreground" aria-hidden />
              Ask
            </h2>
            <span className="font-mono text-caption text-muted-foreground">{open === 0 ? "all asked" : `${open} to ask`}</span>
          </div>
          <VisitQuestions memberId={memberId} appointmentId={appointmentId} partnerName={partner?.displayName} questions={questions} />
        </section>
      </PageGrid>
      )}
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-56 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
