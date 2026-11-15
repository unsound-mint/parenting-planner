import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { formatLongDate } from "@/lib/format";
import { PageFrame } from "@/components/shell/page";
import { BackToCare, Unavailable, WellbeingFallback } from "@/components/wellbeing/chrome";
import { bandWords } from "@/components/wellbeing/screening-bands";
import { PrintButton } from "@/components/wellbeing/print-button";

// A one-page copy of one questionnaire result for the parent's own doctor.
// The family layout hides its navigation when printing (print:hidden). Only the
// author's own results are listed for them, so someone else's id is a 404.
export default function ScreeningPrintPage({ params }: PageProps<"/family/[memberId]/care/screening/[resultId]/print">) {
  return (
    <Suspense fallback={<WellbeingFallback />}>
      <Page params={params} />
    </Suspense>
  );
}

const names = { epds: "Edinburgh Postnatal Depression Scale (EPDS)", phq9: "Patient Health Questionnaire (PHQ-9)" } as const;

async function Page({ params }: { params: Promise<{ memberId: string; resultId: string }> }) {
  const { memberId, resultId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: list }, { data: family }] = await Promise.all([api.GET("/members/{memberId}/mood-screenings", path), api.GET("/family")]);
  if (!list) {
    return (
      <PageFrame className="block pt-4">
        <BackToCare memberId={memberId} />
        <Unavailable title="The result is not loading" />
      </PageFrame>
    );
  }
  const own = list.items.filter((r) => r.authorId === memberId);
  const r = own.find((x) => x.id === resultId);
  if (!r) notFound();
  const earlier = own.filter((x) => x.instrument === r.instrument && x.id !== r.id && x.takenAt < r.takenAt).slice(0, 4);
  const me = family?.parents.find((p) => p.id === memberId);
  const day = (iso: string) => formatLongDate(iso.slice(0, 10));

  return (
    <PageFrame className="block pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackToCare memberId={memberId} />
        <PrintButton />
      </div>
      <article className="mt-4 max-w-2xl rounded-2xl border border-border bg-card p-6 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <p className="text-caption font-semibold tracking-[0.07em] text-muted-foreground uppercase">Mood questionnaire result</p>
        <h1 className="mt-1 text-headline">{names[r.instrument]}</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-label">
          {me && (
            <>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{me.displayName}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Taken</dt>
          <dd>{day(r.takenAt)}</dd>
          <dt className="text-muted-foreground">Score</dt>
          <dd>
            {r.score} of {r.maxScore}
          </dd>
          <dt className="text-muted-foreground">Band</dt>
          <dd>{bandWords[r.band].label}</dd>
        </dl>
        <p className="mt-5 text-body">{r.message ?? bandWords[r.band].step}</p>
        {earlier.length > 0 && (
          <div className="mt-5">
            <h2 className="text-title">Earlier results</h2>
            <ul className="mt-2 divide-y divide-border font-mono text-label">
              {earlier.map((x) => (
                <li key={x.id} className="flex justify-between gap-4 py-1.5">
                  <span>{day(x.takenAt)}</span>
                  <span>
                    {x.score} of {x.maxScore}, {bandWords[x.band].label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-6 border-t border-border pt-3 text-caption text-muted-foreground">
          A screening questionnaire points out when to talk to someone. It is not a diagnosis, and only a clinician can make one.
        </p>
      </article>
    </PageFrame>
  );
}
