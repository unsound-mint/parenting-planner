"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, ClipboardCheck, Clock, Stethoscope, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import type { MoodScreeningDraft, MoodScreeningResult, ScreeningBand, ScreeningQuestionnaire } from "@/lib/api/types";
import { formatDayNumber, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { helpHref } from "@/components/shell/urgent-help-link";
import { Button } from "@/components/ui/button";
import { bandWords } from "./screening-bands";
import { PrintLink, ShareControl, VisitQuestion } from "./screening-actions";

const bandStyle: Record<ScreeningBand, { icon: LucideIcon; tone: string; soft: string }> = {
  green: { icon: CircleCheck, tone: "text-status-ok", soft: "bg-status-ok-soft" },
  amber: { icon: CircleAlert, tone: "text-status-due", soft: "bg-status-due-soft" },
  red: { icon: Stethoscope, tone: "text-status-late", soft: "bg-status-late-soft" },
};
const bandView = Object.fromEntries((Object.keys(bandStyle) as ScreeningBand[]).map((b) => [b, { ...bandWords[b], ...bandStyle[b] }])) as Record<ScreeningBand, typeof bandWords.green & (typeof bandStyle)["green"]>;

const shortName = (q: ScreeningQuestionnaire) => (q.instrument === "epds" ? "EPDS" : "PHQ-9");
const minutes = (q: ScreeningQuestionnaire) => Math.max(1, Math.round(q.questions.length / 5));

type Step = { kind: "pick" } | { kind: "intro"; q: ScreeningQuestionnaire } | { kind: "ask"; q: ScreeningQuestionnaire; draft?: MoodScreeningDraft } | { kind: "result"; q: ScreeningQuestionnaire; r: MoodScreeningResult };

type Partner = { id: string; name: string };

export function Screening({ memberId, questionnaires, past, drafts: savedDrafts, partner }: { memberId: string; questionnaires: ScreeningQuestionnaire[]; past: MoodScreeningResult[]; drafts: MoodScreeningDraft[]; partner?: Partner }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [history, setHistory] = useState(past);
  const [drafts, setDrafts] = useState(savedDrafts);
  const draftOf = (instrument: string) => drafts.find((d) => d.instrument === instrument);
  const withoutDraft = (instrument: string) => (list: MoodScreeningDraft[]) => list.filter((d) => d.instrument !== instrument);

  function startOver(q: ScreeningQuestionnaire) {
    setDrafts(withoutDraft(q.instrument));
    void api.DELETE("/members/{memberId}/mood-screening-drafts/{instrument}", { params: { path: { memberId, instrument: q.instrument } } });
    setStep({ kind: "intro", q });
  }

  return (
    // The list of questionnaires uses the width; a questionnaire in progress keeps a reading measure.
    <div className={cn("mt-2 flex flex-col gap-6", step.kind !== "pick" && "max-w-2xl")}>
      {step.kind === "pick" && (
        <Pick
          questionnaires={questionnaires}
          history={history}
          draftOf={draftOf}
          onStart={(q) => setStep({ kind: "intro", q })}
          onResume={(q) => setStep({ kind: "ask", q, draft: draftOf(q.instrument) })}
          onStartOver={startOver}
          onView={(q, r) => setStep({ kind: "result", q, r })}
        />
      )}
      {step.kind === "intro" && <Intro q={step.q} onBack={() => setStep({ kind: "pick" })} onStart={() => setStep({ kind: "ask", q: step.q })} />}
      {step.kind === "ask" && (
        <Ask
          memberId={memberId}
          q={step.q}
          draft={step.draft}
          onSaved={(d) => setDrafts((list) => [d, ...withoutDraft(d.instrument)(list)])}
          onExit={() => setStep({ kind: "pick" })}
          onDone={(r) => {
            setHistory((h) => [r, ...h]);
            setDrafts(withoutDraft(r.instrument));
            setStep({ kind: "result", q: step.q, r });
          }}
        />
      )}
      {step.kind === "result" && (
        <Result
          memberId={memberId}
          q={step.q}
          r={step.r}
          partner={partner}
          onChange={(r) => {
            setHistory((h) => h.map((x) => (x.id === r.id ? r : x)));
            setStep({ kind: "result", q: step.q, r });
          }}
          onAgain={() => setStep({ kind: "pick" })}
        />
      )}
    </div>
  );
}

function Pick({
  questionnaires,
  history,
  draftOf,
  onStart,
  onResume,
  onStartOver,
  onView,
}: {
  questionnaires: ScreeningQuestionnaire[];
  history: MoodScreeningResult[];
  draftOf: (instrument: string) => MoodScreeningDraft | undefined;
  onStart: (q: ScreeningQuestionnaire) => void;
  onResume: (q: ScreeningQuestionnaire) => void;
  onStartOver: (q: ScreeningQuestionnaire) => void;
  onView: (q: ScreeningQuestionnaire, r: MoodScreeningResult) => void;
}) {
  // The one your plan asks for comes first.
  // A half-finished one comes before the rest.
  const sorted = [...questionnaires].sort((a, b) => Number(!!draftOf(b.instrument)) - Number(!!draftOf(a.instrument)) || Number(b.suggested) - Number(a.suggested));
  return (
    <>
      <div>
        <h1 className="flex items-center gap-3 text-headline">
          <ClipboardCheck className="size-7 text-primary" aria-hidden />
          How have you been feeling?
        </h1>
        <p className="mt-2 text-label font-normal text-muted-foreground">A short questionnaire. It points out when to talk to someone. It is not a diagnosis.</p>
      </div>
      <ul className="grid gap-3 @4xl:grid-cols-2">
        {sorted.map((q) => {
          const last = history.find((h) => h.instrument === q.instrument);
          const view = last && bandView[last.band];
          const draft = draftOf(q.instrument);
          const done = draft?.answers.length ?? 0;
          return (
            <li key={q.instrument} className={cn("rounded-2xl border bg-card p-5", q.suggested ? "border-primary" : "border-border")}>
              {q.suggested && <p className="mb-2 text-caption font-semibold tracking-[0.07em] text-primary uppercase">Suggested for you now</p>}
              <h2 className="text-title">{q.title}</h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-caption text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  {q.questions.length} questions, about {minutes(q)} min
                </span>
                {last && view && (
                  <button type="button" onClick={() => onView(q, last)} className={cn("inline-flex min-h-8 items-center gap-1.5 underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50", view.tone)}>
                    <view.icon className="size-3.5" aria-hidden />
                    Last: {view.label}, {formatMonth(last.takenAt)} {formatDayNumber(last.takenAt)}
                  </button>
                )}
              </p>
              {draft && done > 0 && (
                <div className="mt-4">
                  <div role="progressbar" aria-label={`${shortName(q)} saved answers`} aria-valuemin={0} aria-valuemax={q.questions.length} aria-valuenow={done} className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(done / q.questions.length) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 font-mono text-caption text-muted-foreground">
                    Saved at {done} of {q.questions.length}, {formatMonth(draft.updatedAt)} {formatDayNumber(draft.updatedAt)}
                  </p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button type="button" size="lg" variant={q.suggested || draft ? "default" : "outline"} onClick={() => (draft && done > 0 ? onResume(q) : onStart(q))} className="h-11 w-full sm:w-fit sm:px-6">
                  {draft && done > 0 ? "Continue" : last ? "Take it again" : "Start"}
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
                {draft && done > 0 && (
                  <Button type="button" size="lg" variant="ghost" onClick={() => onStartOver(q)} className="h-11 px-3">
                    Start over
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Intro({ q, onBack, onStart }: { q: ScreeningQuestionnaire; onBack: () => void; onStart: () => void }) {
  return (
    <section aria-labelledby="intro-title" className="rounded-2xl border border-border bg-card p-6">
      <h1 id="intro-title" className="text-headline">
        {shortName(q)}
      </h1>
      <p className="mt-4 text-body">{q.intro}</p>
      <p className="mt-3 flex items-center gap-1.5 font-mono text-caption text-muted-foreground">
        <Clock className="size-3.5" aria-hidden />
        {q.questions.length} questions, one at a time. Only you see the answers.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="h-11 sm:px-6">
          Back
        </Button>
        <Button type="button" size="lg" onClick={onStart} className="h-11 sm:px-6">
          Begin
        </Button>
      </div>
    </section>
  );
}

function Ask({ memberId, q, draft, onSaved, onExit, onDone }: { memberId: string; q: ScreeningQuestionnaire; draft?: MoodScreeningDraft; onSaved: (d: MoodScreeningDraft) => void; onExit: () => void; onDone: (r: MoodScreeningResult) => void }) {
  const router = useRouter();
  const [i, setI] = useState(() => Math.min(draft?.answers.length ?? 0, q.questions.length - 1));
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => q.questions.map((_, n) => draft?.answers[n]));
  // Saves run one after another so a slow one cannot overwrite a newer one.
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const [pending, startTransition] = useTransition();
  const total = q.questions.length;
  const question = q.questions[i];
  const last = i === total - 1;

  function submit(all: number[]) {
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/mood-screenings", {
        params: { path: { memberId } },
        body: { instrument: q.instrument, answers: all, visibility: "private" },
      });
      if (error || !data) {
        toast.error("Could not save your answers. Please try again.");
        return;
      }
      // Fixed crisis screen, not generated text. The result is already saved.
      if (data.urgent) {
        router.push(helpHref(memberId));
        return;
      }
      onDone(data);
    });
  }

  // The draft holds the answers up to the first gap, in question order. A failed save is
  // silent: the answers stay on screen and the next pick tries again.
  function save(next: (number | undefined)[]) {
    const gap = next.findIndex((a) => a === undefined);
    const prefix = (gap === -1 ? next : next.slice(0, gap)) as number[];
    saving.current = saving.current.then(async () => {
      const { data } = await api.PUT("/members/{memberId}/mood-screening-drafts/{instrument}", {
        params: { path: { memberId, instrument: q.instrument } },
        body: { answers: prefix },
      });
      if (data) onSaved(data);
    });
  }

  function pick(value: number) {
    const next = answers.map((a, n) => (n === i ? value : a));
    setAnswers(next);
    save(next);
    if (!last) setTimeout(() => setI((n) => Math.min(n + 1, total - 1)), 160);
  }

  const complete = answers.every((a) => a !== undefined);

  return (
    <section aria-labelledby="q-title" className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div role="progressbar" aria-label={`${shortName(q)} progress`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={i + 1} className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-(--ease-out)" style={{ width: `${((i + 1) / total) * 100}%` }} />
        </div>
        <span className="font-mono text-caption text-muted-foreground tabular-nums">
          {i + 1} of {total}
        </span>
      </div>

      <h1 id="q-title" className="mt-6 text-title text-balance">
        {question.text}
      </h1>
      <div role="radiogroup" aria-labelledby="q-title" className="mt-5 flex flex-col gap-2">
        {question.choices.map((c) => {
          const on = answers[i] === c.value;
          return (
            <button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => pick(c.value)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-background hover:bg-muted",
              )}
            >
              <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary" : "border-border")}>
                {on && <span className="size-2 rounded-full bg-primary-foreground" />}
              </span>
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {i > 0 && (
            <Button type="button" variant="ghost" size="lg" onClick={() => setI(i - 1)} className="h-11 px-3">
              <ArrowLeft data-icon="inline-start" aria-hidden />
              Back
            </Button>
          )}
          <Button type="button" variant="ghost" size="lg" onClick={onExit} className="h-11 px-3">
            {answers.some((a) => a !== undefined) ? "Finish later" : "Stop"}
          </Button>
        </div>
        {last && (
          <Button type="button" size="lg" disabled={!complete || pending} onClick={() => submit(answers as number[])} className="h-11 px-6">
            {pending ? "Saving..." : "See my result"}
          </Button>
        )}
      </div>
    </section>
  );
}

function Result({ memberId, q, r, partner, onChange, onAgain }: { memberId: string; q: ScreeningQuestionnaire; r: MoodScreeningResult; partner?: Partner; onChange: (r: MoodScreeningResult) => void; onAgain: () => void }) {
  const view = bandView[r.band];
  const pct = Math.round((r.score / r.maxScore) * 100);
  return (
    <section aria-labelledby="result-title" className="rounded-2xl border border-border bg-card p-6">
      <p className="text-caption font-semibold tracking-[0.07em] text-primary uppercase">Your result</p>
      <div className="mt-3 flex items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", view.soft, view.tone)}>
          <view.icon className="size-7" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 id="result-title" className="text-headline">
            {view.label}
          </h1>
          <p className="font-mono text-caption text-muted-foreground">
            {shortName(q)} score {r.score} of {r.maxScore}
          </p>
        </div>
      </div>
      <div role="img" aria-label={`Score ${r.score} of ${r.maxScore}`} className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", r.band === "green" ? "bg-status-ok" : r.band === "amber" ? "bg-status-due" : "bg-status-late")} style={{ width: `${pct}%` }} />
      </div>

      <div className={cn("mt-5 rounded-xl p-4", view.soft)}>
        <p className="text-caption font-semibold tracking-[0.07em] uppercase">Next step</p>
        <p className="mt-1 text-body">{r.message ?? view.step}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {r.band === "amber" && <VisitQuestion memberId={memberId} name={shortName(q)} r={r} />}
        {r.band !== "green" && (
          <Link
            href={`/family/${memberId}/directory`}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-label font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              r.band === "red" ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted",
            )}
          >
            Find a perinatal therapist
          </Link>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5">
        <ShareControl memberId={memberId} r={r} partner={partner} onChange={onChange} />
        <PrintLink memberId={memberId} resultId={r.id} />
        <Button type="button" size="lg" onClick={onAgain} className="mt-2 h-11 w-full sm:w-fit sm:px-8">
          Done
        </Button>
      </div>
      <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
        A screening is not a diagnosis. If you ever feel unsafe, <a href={helpHref(memberId)} className="underline underline-offset-2">get urgent help now</a>.
      </p>
    </section>
  );
}
