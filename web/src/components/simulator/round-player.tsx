"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CalendarCheck, Check, CheckCircle2, CircleAlert, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Shift, ShiftSuggestion, SimulatorAnswerResult, SimulatorQuestion, SimulatorRound } from "@/lib/api/types";
import { skillIcon, skillLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShiftCard } from "@/components/schedule/shift-card";
import { SkillBars } from "@/components/simulator/skill-bars";
import { StartRoundButton } from "@/components/simulator/start-round-button";
import { PageFrame } from "@/components/shell/page";
import { SourceLink } from "@/components/joy/source-line";

// Plays one round: a question, a tap, feedback at once, then the next. The
// last screen scores the round and offers the one commit action.
export function RoundPlayer({ memberId, initial, calendarOpen }: { memberId: string; initial: SimulatorRound; calendarOpen: boolean }) {
  const [round, setRound] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, SimulatorAnswerResult>>(() =>
    Object.fromEntries(initial.questions.filter((q) => q.answer).map((q) => [q.id, q.answer!])),
  );
  const firstOpen = initial.questions.findIndex((q) => !q.answer);
  const [index, setIndex] = useState(initial.completed || firstOpen < 0 ? initial.questions.length : firstOpen);
  const [pending, startTransition] = useTransition();

  const total = round.questions.length;
  const question = round.questions[index];

  function answer(q: SimulatorQuestion, choiceId: string) {
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/simulator-rounds/{roundId}/answers", {
        params: { path: { memberId, roundId: round.id } },
        body: { questionId: q.id, choiceId },
      });
      if (error || !data) {
        toast.error("Could not save that answer. Please try again.");
        return;
      }
      setAnswers((prev) => ({ ...prev, [q.id]: data }));
    });
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    // Last answer given: the round now has its result.
    startTransition(async () => {
      const { data } = await api.GET("/members/{memberId}/simulator-rounds/{roundId}", {
        params: { path: { memberId, roundId: round.id } },
      });
      if (!data?.result) {
        toast.error("Could not load your result. Please try again.");
        return;
      }
      setRound(data);
      setIndex(total);
    });
  }

  if (!question) {
    if (!round.result) return <ResultLoading />;
    return <Result memberId={memberId} round={round} calendarOpen={calendarOpen} />;
  }

  const given = answers[question.id];
  return (
    // One question at a time: the question keeps a reading measure instead of the page grid.
    <PageFrame className="max-w-2xl">
      <Progress questions={round.questions} answers={answers} index={index} title={round.title} />
      <QuestionCard
        key={question.id}
        question={question}
        given={given}
        busy={pending}
        isLast={index + 1 >= total}
        onChoose={(choiceId) => answer(question, choiceId)}
        onNext={next}
      />
    </PageFrame>
  );
}

function Progress({
  questions,
  answers,
  index,
  title,
}: {
  questions: SimulatorQuestion[];
  answers: Record<string, SimulatorAnswerResult>;
  index: number;
  title: string;
}) {
  const right = questions.filter((q) => answers[q.id]?.correct).length;
  return (
    <header className="flex flex-col gap-3">
      <p className="flex items-baseline justify-between gap-3 text-label text-muted-foreground">
        <span>{title}</span>
        <span className="font-mono text-caption">
          Question {index + 1} of {questions.length} · {right} right
        </span>
      </p>
      <ol className="flex gap-1.5" aria-hidden>
        {questions.map((q, i) => {
          const a = answers[q.id];
          return (
            <li
              key={q.id}
              className={cn(
                "h-2 flex-1 rounded-full transition-colors duration-220",
                a ? (a.correct ? "bg-status-ok" : "bg-status-due") : i === index ? "bg-primary/40" : "bg-muted",
              )}
            />
          );
        })}
      </ol>
    </header>
  );
}

function QuestionCard({
  question,
  given,
  busy,
  isLast,
  onChoose,
  onNext,
}: {
  question: SimulatorQuestion;
  given?: SimulatorAnswerResult;
  busy: boolean;
  isLast: boolean;
  onChoose: (choiceId: string) => void;
  onNext: () => void;
}) {
  const Skill = skillIcon[question.skill];
  const nextRef = useRef<HTMLButtonElement>(null);
  // After the feedback appears, keyboard focus goes to "Next" so Enter continues.
  useEffect(() => {
    if (given) nextRef.current?.focus();
  }, [given]);

  return (
    <section aria-labelledby="q-prompt" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-caption font-medium text-muted-foreground">
          <Skill className="size-3.5" aria-hidden />
          {skillLabel[question.skill]}
        </span>
        <h1 id="q-prompt" className="text-headline text-balance">
          {question.prompt}
        </h1>
      </div>

      <ul className="flex flex-col gap-2">
        {question.choices.map((c) => {
          const picked = given?.choiceId === c.id;
          const isRight = given?.correctChoiceId === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!!given || busy}
                aria-pressed={picked}
                onClick={() => onChoose(c.id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-body transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  !given && "border-border bg-card hover:border-primary/50 hover:bg-secondary active:translate-y-px",
                  given && isRight && "border-status-ok bg-status-ok-soft",
                  given && picked && !isRight && "border-status-due bg-status-due-soft",
                  given && !picked && !isRight && "border-border bg-card text-muted-foreground",
                )}
              >
                <span className="min-w-0 flex-1">{c.text}</span>
                {given && isRight && <Check className="size-5 shrink-0 text-status-ok" aria-label="Right answer" />}
                {given && picked && !isRight && <X className="size-5 shrink-0 text-status-due" aria-label="Your answer" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite">
        {given && (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-2xl p-5",
              given.correct ? "bg-status-ok-soft" : "bg-status-due-soft",
            )}
          >
            <p className={cn("flex items-center gap-2 text-title", given.correct ? "text-status-ok" : "text-status-due")}>
              {given.correct ? <CheckCircle2 className="size-5" aria-hidden /> : <CircleAlert className="size-5" aria-hidden />}
              {given.correct ? "Right" : "Not quite"}
            </p>
            <p className="text-body">{given.explanation}</p>
            {given.source && (
              <p className="text-caption">
                <SourceLink source={given.source} />
              </p>
            )}
            <div>
              <Button ref={nextRef} type="button" onClick={onNext} disabled={busy} className="h-11 gap-2 px-4 text-label">
                {isLast ? "See result" : "Next question"}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ResultLoading() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-64 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}

function Result({ memberId, round, calendarOpen }: { memberId: string; round: SimulatorRound; calendarOpen: boolean }) {
  const result = round.result!;
  const router = useRouter();
  const missed = result.total - result.correct;
  const weak = result.weakSpots;
  const headline =
    missed === 0
      ? `All ${result.total} right.`
      : weak.length > 0
        ? `${result.correct} of ${result.total} right. ${skillLabel[weak[0]]} needs another look.`
        : `${result.correct} of ${result.total} right.`;
  const [shift, setShift] = useState<Shift>();
  const suggestion = result.suggestedShift;

  return (
    <PageFrame className="grid content-start gap-8 @5xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-labelledby="result-headline" className="flex min-w-0 flex-col gap-6">
        <div className="flex items-center gap-5">
          <ScoreRing correct={result.correct} total={result.total} />
          <div className="min-w-0">
            <h1 id="result-headline" className="text-headline text-balance">
              {headline}
            </h1>
            <p className="mt-1 text-label font-normal text-muted-foreground">{round.title}</p>
          </div>
        </div>

        {shift ? (
          <Committed shift={shift} calendarHref={calendarOpen ? `/family/${memberId}/calendar` : undefined} />
        ) : suggestion ? (
          <CommitCard
            memberId={memberId}
            roundId={round.id}
            suggestion={suggestion}
            onCommitted={(s) => {
              setShift(s);
              router.refresh();
            }}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {weak.length > 0 && <StartRoundButton memberId={memberId} mode="practice" label="Practice weak spots" variant={shift || !suggestion ? "default" : "secondary"} />}
          <Link
            href={`/family/${memberId}/simulator`}
            className="flex min-h-11 items-center rounded-lg px-3 text-label text-muted-foreground hover:bg-muted hover:text-foreground md:min-h-10"
          >
            Back to practice
          </Link>
        </div>
      </section>

      <aside className="min-w-0 @5xl:pt-1">
        <section aria-labelledby="after-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="after-title" className="text-title">
            Your skills now
          </h2>
          <div className="mt-4">
            <SkillBars skills={result.skills} highlight={weak} />
          </div>
        </section>
      </aside>
    </PageFrame>
  );
}

function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const share = total === 0 ? 0 : correct / total;
  return (
    <div className="relative size-24 shrink-0" role="img" aria-label={`${correct} of ${total} right`}>
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          className={share >= 0.7 ? "stroke-status-ok" : "stroke-status-due"}
        />
      </svg>
      <span aria-hidden className="absolute inset-0 flex items-center justify-center font-mono text-title tabular-nums">
        {correct}/{total}
      </span>
    </div>
  );
}

function CommitCard({
  memberId,
  roundId,
  suggestion,
  onCommitted,
}: {
  memberId: string;
  roundId: string;
  suggestion: ShiftSuggestion;
  onCommitted: (shift: Shift) => void;
}) {
  const [pending, startTransition] = useTransition();

  function commit() {
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/shifts", {
        params: { path: { memberId } },
        body: { ...suggestion, roundId },
      });
      if (error || !data) {
        toast.error(
          error?.code === "shift_overlap"
            ? "That overlaps a shift you already have."
            : error?.code === "forbidden"
              ? "You do not have permission to commit to shifts."
              : "Could not save the shift. Please try again.",
        );
        return;
      }
      onCommitted(data);
    });
  }

  return (
    <section aria-labelledby="commit-title" className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-secondary p-5">
      <h2 id="commit-title" className="text-title text-secondary-foreground">
        Put it into practice
      </h2>
      <ShiftCard shift={suggestion} />
      <div>
        <Button type="button" onClick={commit} disabled={pending} className="h-12 w-full gap-2 px-5 text-label sm:w-auto">
          <CalendarCheck className="size-4.5" aria-hidden />
          {pending ? "Saving..." : "Commit to this shift"}
        </Button>
      </div>
    </section>
  );
}

function Committed({ shift, calendarHref }: { shift: Shift; calendarHref?: string }) {
  const active = shift.status === "active";
  return (
    <section aria-labelledby="committed-title" role="status" className="flex flex-col gap-4 rounded-2xl bg-status-ok-soft p-5">
      <h2 id="committed-title" className="flex items-center gap-2 text-title text-status-ok">
        <CheckCircle2 className="size-5" aria-hidden />
        {shift.title} is yours
      </h2>
      <ShiftCard shift={shift} note={active ? "In your calendar from today." : "Starts the day the baby is home."} />
      {calendarHref && (
        <div>
          <Link href={calendarHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-label text-primary-foreground hover:bg-primary/80">
            <CalendarCheck className="size-4" aria-hidden />
            Open calendar
          </Link>
        </div>
      )}
    </section>
  );
}
