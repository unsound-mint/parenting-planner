import { Suspense } from "react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { formatClock, formatDayNumber, formatLongDate, formatMonth, formatWeekday } from "@/lib/format";
import { PageFrame } from "@/components/shell/page";
import { BackToCare, Unavailable, WellbeingFallback } from "@/components/wellbeing/chrome";
import { PrintButton } from "@/components/wellbeing/print-button";
import { Sparkline, moodWords } from "@/components/care/brief-mood";
import { cleanName } from "@/components/care/names";

// The session brief as the psychologist gets it: one page, only what the
// parent chose. A draft says so at the top. The family layout hides its
// navigation when printing (print:hidden); "Save as PDF" in the print dialog
// makes the file. The brief belongs to the acting parent alone.
export default function BriefPrintPage({ params }: PageProps<"/family/[memberId]/care/brief/print">) {
  return (
    <Suspense fallback={<WellbeingFallback />}>
      <Page params={params} />
    </Suspense>
  );
}

const at = (iso: string) => `${formatWeekday(iso)} ${formatMonth(iso)} ${formatDayNumber(iso)}, ${formatClock(iso)} ET`;

async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [{ data: brief }, { data: family }] = await Promise.all([
    api.GET("/members/{memberId}/session-brief", { params: { path: { memberId } } }),
    api.GET("/family"),
  ]);
  if (!brief) {
    return (
      <PageFrame className="block pt-4">
        <BackToCare memberId={memberId} />
        <Unavailable title="The brief is not loading" />
      </PageFrame>
    );
  }
  const me = family?.parents.find((p) => p.id === memberId);
  const doctor = brief.session ? cleanName(brief.session.provider.name) : undefined;
  const mood = brief.status === "draft" ? (brief.includeMood ? brief.mood : undefined) : brief.mood;

  return (
    <PageFrame className="block pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackToCare memberId={memberId} />
        <PrintButton />
      </div>
      <article className="mt-4 max-w-3xl rounded-2xl border border-border bg-card p-6 md:p-9 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        {brief.status === "draft" && (
          <p className="mb-4 rounded-xl bg-muted px-3 py-2 text-caption text-muted-foreground print:border print:border-border">
            Draft. Only you have seen this; nothing has been sent.
          </p>
        )}
        <p className="text-caption font-semibold tracking-[0.07em] text-muted-foreground uppercase">Session brief</p>
        <h1 className="mt-1 text-headline">{me ? `From ${me.displayName}` : "Before our session"}</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-label">
          {doctor && (
            <>
              <dt className="text-muted-foreground">For</dt>
              <dd>{doctor}</dd>
            </>
          )}
          {brief.session && (
            <>
              <dt className="text-muted-foreground">Session</dt>
              <dd>
                {at(brief.session.startsAt)}, {brief.session.durationMinutes} min
              </dd>
            </>
          )}
          {brief.sentAt && (
            <>
              <dt className="text-muted-foreground">Sent</dt>
              <dd>{at(brief.sentAt)}</dd>
            </>
          )}
        </dl>

        {brief.note && (
          <section className="mt-6">
            <h2 className="text-title">A note</h2>
            <p className="mt-1.5 text-body whitespace-pre-line">{brief.note}</p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-title">What I would like to talk about</h2>
          {brief.items.length === 0 ? (
            <p className="mt-1.5 text-body text-muted-foreground">No topics yet.</p>
          ) : (
            <ol className="mt-2 flex list-decimal flex-col gap-3 pl-5">
              {brief.items.map((it, i) => (
                <li key={`${i}-${it.text}`} className="pl-1 marker:font-heading marker:text-muted-foreground">
                  <p className="text-body font-semibold">{it.text}</p>
                  {it.entryText && (
                    <blockquote className="mt-1 border-l-2 border-line-2 pl-3 text-body whitespace-pre-line text-ink-2">
                      {it.entryText}
                      {it.writtenAt && <span className="mt-1 block font-mono text-caption text-muted-foreground">From my journal, {formatLongDate(it.writtenAt.slice(0, 10))}</span>}
                    </blockquote>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {mood && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="text-title">My check-ins</h2>
            <p className="mt-1 font-mono text-caption text-muted-foreground">
              {formatLongDate(mood.from)} to {formatLongDate(mood.to)}
            </p>
            <div className="mt-3 flex items-center gap-5">
              <Sparkline mood={mood} className="h-16 w-56" />
              <p className="text-body">{moodWords(mood)}</p>
            </div>
            <p className="mt-2 text-caption text-muted-foreground">Mood on a 1 to 5 scale I chose each day; a low day is 2 or under. What I logged, not an assessment.</p>
          </section>
        )}
      </article>
    </PageFrame>
  );
}
