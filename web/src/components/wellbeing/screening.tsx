"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, ClipboardCheck, Clock, Stethoscope, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import type { MoodScreeningResult, ScreeningBand, ScreeningQuestionnaire } from "@/lib/api/types";
import { formatDayNumber, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { helpHref } from "@/components/shell/urgent-help-link";
import { Button } from "@/components/ui/button";

// Fixed wording per band. The API sends its own fixed message too (never
// generated); this is what shows if it is missing. Wording is Dayana's.
const bandView: Record<ScreeningBand, { label: string; icon: LucideIcon; tone: string; soft: string; step: string }> = {
  green: { label: "Below the cutoff", icon: CircleCheck, tone: "text-status-ok", soft: "bg-status-ok-soft", step: "Nothing to do now. Take it again in a few weeks, or any time things change." },
  amber: { label: "Close to the cutoff", icon: CircleAlert, tone: "text-status-due", soft: "bg-status-due-soft", step: "Take it again in two weeks and mention it at your next visit." },
  red: { label: "At or above the cutoff", icon: Stethoscope, tone: "text-status-late", soft: "bg-status-late-soft", step: "Talk to your doctor or midwife soon. A questionnaire cannot diagnose anything, they can." },
};

const shortName = (q: ScreeningQuestionnaire) => (q.instrument === "epds" ? "EPDS" : "PHQ-9");
const minutes = (q: ScreeningQuestionnaire) => Math.max(1, Math.round(q.questions.length / 5));

type Step = { kind: "pick" } | { kind: "intro" | "ask"; q: ScreeningQuestionnaire } | { kind: "result"; q: ScreeningQuestionnaire; r: MoodScreeningResult };

export function Screening({ memberId, questionnaires, past }: { memberId: string; questionnaires: ScreeningQuestionnaire[]; past: MoodScreeningResult[] }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [history, setHistory] = useState(past);

  return (
    // The list of questionnaires uses the width; a questionnaire in progress keeps a reading measure.
    <div className={cn("mt-2 flex flex-col gap-6", step.kind !== "pick" && "max-w-2xl")}>
      {step.kind === "pick" && <Pick questionnaires={questionnaires} history={history} onStart={(q) => setStep({ kind: "intro", q })} />}
      {step.kind === "intro" && <Intro q={step.q} onBack={() => setStep({ kind: "pick" })} onStart={() => setStep({ kind: "ask", q: step.q })} />}
      {step.kind === "ask" && (
        <Ask
          memberId={memberId}
          q={step.q}
          onExit={() => setStep({ kind: "pick" })}
          onDone={(r) => {
            setHistory((h) => [r, ...h]);
            setStep({ kind: "result", q: step.q, r });
          }}
        />
      )}
      {step.kind === "result" && <Result memberId={memberId} q={step.q} r={step.r} onAgain={() => setStep({ kind: "pick" })} />}
    </div>
  );
}

function Pick({ questionnaires, history, onStart }: { questionnaires: ScreeningQuestionnaire[]; history: MoodScreeningResult[]; onStart: (q: ScreeningQuestionnaire) => void }) {
  // The one your plan asks for comes first.
  const sorted = [...questionnaires].sort((a, b) => Number(b.suggested) - Number(a.suggested));
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
                  <span className={cn("inline-flex items-center gap-1.5", view.tone)}>
                    <view.icon className="size-3.5" aria-hidden />
                    Last: {view.label}, {formatMonth(last.takenAt)} {formatDayNumber(last.takenAt)}
                  </span>
                )}
              </p>
              <Button type="button" size="lg" variant={q.suggested ? "default" : "outline"} onClick={() => onStart(q)} className="mt-4 h-11 w-full sm:w-fit sm:px-6">
                {last ? "Take it again" : "Start"}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
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

function Ask({ memberId, q, onExit, onDone }: { memberId: string; q: ScreeningQuestionnaire; onExit: () => void; onDone: (r: MoodScreeningResult) => void }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => q.questions.map(() => undefined));
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

  function pick(value: number) {
    const next = answers.map((a, n) => (n === i ? value : a));
    setAnswers(next);
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
        <Button type="button" variant="ghost" size="lg" onClick={() => (i === 0 ? onExit() : setI(i - 1))} className="h-11 px-3">
          <ArrowLeft data-icon="inline-start" aria-hidden />
          {i === 0 ? "Stop" : "Back"}
        </Button>
        {last && (
          <Button type="button" size="lg" disabled={!complete || pending} onClick={() => submit(answers as number[])} className="h-11 px-6">
            {pending ? "Saving..." : "See my result"}
          </Button>
        )}
      </div>
      <p className="mt-4 border-t border-border pt-3 font-mono text-caption text-muted-foreground">
        Source: {q.source.title}, checked {q.source.checkedAt}
      </p>
    </section>
  );
}

function Result({ memberId, q, r, onAgain }: { memberId: string; q: ScreeningQuestionnaire; r: MoodScreeningResult; onAgain: () => void }) {
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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {r.band !== "green" && (
          <Link href={`/family/${memberId}/directory`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-label font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Find a perinatal therapist
          </Link>
        )}
        <Button type="button" variant="outline" size="lg" onClick={onAgain} className="h-11 px-6">
          Done
        </Button>
      </div>
      <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
        A screening is not a diagnosis. If you ever feel unsafe, <a href={helpHref(memberId)} className="underline underline-offset-2">get urgent help now</a>.
      </p>
      <p className="mt-2 font-mono text-caption text-muted-foreground">
        Source:{" "}
        <a href={r.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {r.source.title}
        </a>
        , checked {r.source.checkedAt}
      </p>
    </section>
  );
}
