"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { saveQuizAnswer } from "@/app/family/[memberId]/learn/actions";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import type { LearningPath, Lesson, QuizAttempt, QuizQuestion } from "@/lib/api/types";
import { type Couple, withQuizResult } from "./model";
import { QuizCard } from "./quiz-card";
import { QuizRetake } from "./quiz-retake";

type Deck = { path: LearningPath; questions: { q: QuizQuestion; lesson: Lesson }[] };

const mineOf = (q: QuizQuestion, id: string) => q.answers.find((a) => a.memberId === id);

function tally(d: Deck, me: string) {
  let right = 0;
  let missed = 0;
  for (const { q } of d.questions) {
    const a = mineOf(q, me);
    if (a?.correct === true) right++;
    else if (a) missed++;
  }
  return { total: d.questions.length, right, missed, open: d.questions.length - right - missed };
}

/**
 * Quiz decks: one per learning path, drawing every question of its lessons.
 * Answers are the same ones Learn saves (one per parent per question), so a
 * deck shows where you stand, not points: right, to review, still open
 * (docs/design.md, no scores or streaks). A deck opens to its next open
 * question and a review list of the ones you missed, with the why.
 */
export function QuizDecks({
  memberId,
  couple,
  initialPaths,
  initialAttempts,
  initialDeck,
}: {
  memberId: string;
  couple: Couple;
  initialPaths: LearningPath[];
  initialAttempts: QuizAttempt[];
  initialDeck?: string;
}) {
  const [attempts, setAttempts] = useState(initialAttempts);
  const [retaking, setRetaking] = useState(false);
  const lastOf = (id: string) => attempts.find((a) => a.deckId === id);
  const router = useRouter();
  const [paths, setPaths] = useState(initialPaths);
  const [deckId, setDeckId] = useState<string | null>(initialDeck ?? null);
  const me = couple.me.id;
  const decks: Deck[] = paths
    .map((path) => ({ path, questions: path.lessons.flatMap((lesson) => lesson.quiz.map((q) => ({ q, lesson }))) }))
    .filter((d) => d.questions.length > 0);
  const deck = decks.find((d) => d.path.id === deckId);
  const all = decks.reduce((n, d) => n + d.questions.length, 0);

  async function answer(q: QuizQuestion, choiceId: string): Promise<boolean> {
    const res = await saveQuizAnswer(memberId, q.id, choiceId);
    if (!res.ok) {
      toast.error("Could not save your answer. Please try again.");
      return false;
    }
    setPaths((ps) => withQuizResult(ps, q, me, choiceId, res.data));
    return true;
  }
  const openLesson = (l: Lesson) => router.push(`/family/${memberId}/learn?path=${encodeURIComponent(l.pathId)}&lesson=${encodeURIComponent(l.id)}`);
  const choose = (id: string | null) => {
    setDeckId(id);
    setRetaking(false);
    window.history.replaceState(null, "", id ? `?deck=${encodeURIComponent(id)}` : window.location.pathname);
  };

  if (!deck) {
    return (
      <>
        <Rise as="header" i={0}>
          <h1 className="text-headline">Quiz decks</h1>
          <p className="mt-1.5 max-w-prose text-body text-ink-2">
            {all} questions from your paths in {decks.length} decks. Answer at your pace; the ones you miss come back for review with the reason.
          </p>
        </Rise>
        <Rise i={1}>
        <ul className="grid min-w-0 gap-4 @xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4">
          {decks.map((d) => {
            const t = tally(d, me);
            return (
              <li key={d.path.id} className="min-w-0">
                <button type="button" onClick={() => choose(d.path.id)} className="press flex h-full w-full min-w-0 flex-col gap-3 rounded-3xl border border-line bg-card p-5 text-left hover:border-line-2">
                  <span className="text-caption text-muted-foreground">
                    {t.total} questions · {d.path.lessons.length} lessons
                  </span>
                  <span className="line-clamp-2 text-title text-balance">{d.path.title}</span>
                  <Bar t={t} />
                  <span className="text-label font-normal text-ink-2">
                    {t.open === t.total ? "Not started" : `${t.right} right${t.missed ? `, ${t.missed} to review` : ""}${t.open ? `, ${t.open} open` : ""}`}
                  </span>
                  {lastOf(d.path.id) && (
                    <span className="text-caption text-muted-foreground">
                      Last retake: {lastOf(d.path.id)!.score} of {lastOf(d.path.id)!.total}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        </Rise>
      </>
    );
  }

  const t = tally(deck, me);
  const quizLesson = deck.path.lessons.find((l) => l.quiz.some((q) => !mineOf(q, me)));
  const after = quizLesson && deck.path.lessons.slice(deck.path.lessons.indexOf(quizLesson) + 1).find((l) => l.quiz.some((q) => !mineOf(q, me)));
  // After a retake, review follows the latest attempt; before it, the first answers.
  const latest = lastOf(deck.path.id);
  const missed = deck.questions.filter(({ q }) => (latest ? latest.missed.includes(q.id) : mineOf(q, me)?.correct === false));
  const history = attempts.filter((a) => a.deckId === deck.path.id).slice(0, 6);

  return (
    <>
      <Rise as="header" i={0} className="flex flex-col gap-3">
        <button type="button" onClick={() => choose(null)} className="press inline-flex min-h-11 w-fit items-center gap-1.5 pr-3 text-label text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          All decks
        </button>
        <h1 className="text-headline">{deck.path.title}</h1>
        <div className="flex max-w-xl flex-col gap-2">
          <Bar t={t} />
          <p className="text-label font-normal text-ink-2">
            {t.right} of {t.total} right{t.missed ? `, ${t.missed} to review` : ""}
            {t.open ? `, ${t.open} still open` : ""}
          </p>
        </div>
      </Rise>
      <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-2">
        <Rise i={1} className="min-w-0">
          {retaking ? (
            <QuizRetake
              memberId={memberId}
              deckId={deck.path.id}
              questions={deck.questions.map(({ q }) => q)}
              onCancel={() => setRetaking(false)}
              onDone={(a) => {
                setAttempts((list) => [a, ...list]);
                setRetaking(false);
              }}
            />
          ) : quizLesson ? (
            <QuizCard key={quizLesson.id} lesson={quizLesson} couple={couple} nextLesson={after} onAnswer={answer} onOpenLesson={openLesson} />
          ) : (
            <SoftCard tone="leaf" className="flex flex-col gap-3">
              <Check className="size-6 text-leaf" aria-hidden />
              <p className="text-title">{latest ? `Last retake: ${latest.score} of ${latest.total} right` : "Every question in this deck is answered"}</p>
              <p className="text-label font-normal text-ink-2">
                {missed.length ? "Read the reasons beside it, then take the deck again to see what stuck." : "Take it again in a week or two to see what stuck."}
              </p>
              <button type="button" onClick={() => setRetaking(true)} className="press inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-me px-4.5 text-label font-semibold text-white">
                <RotateCcw className="size-4" aria-hidden />
                Retake this deck
              </button>
              {history.length > 0 && <History items={history} />}
            </SoftCard>
          )}
        </Rise>
        <Rise as="section" i={2} aria-labelledby="review-title" className="flex min-w-0 flex-col gap-3">
          <h2 id="review-title" className="flex items-baseline gap-2 text-title">
            <RotateCcw className="size-4.5 self-center text-me" aria-hidden />
            Review the ones you missed
            <span className="font-mono text-caption text-muted-foreground">{missed.length}</span>
          </h2>
          {missed.length === 0 ? (
            <p className="text-label font-normal text-ink-2">Nothing to review yet. A question you miss lands here with the reason.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {missed.map(({ q, lesson }) => (
                <li key={q.id} className="flex flex-col gap-1.5 rounded-3xl border border-line bg-card p-4">
                  <p className="text-label font-semibold">{q.prompt}</p>
                  <p className="text-label font-normal text-ink-2">
                    Right answer: <span className="text-ink">{q.choices.find((c) => c.id === q.correctChoiceId)?.text}</span>
                  </p>
                  {q.explanation && <p className="text-label font-normal text-ink-2">{q.explanation}</p>}
                  <Link href={`/family/${memberId}/learn?path=${encodeURIComponent(lesson.pathId)}&lesson=${encodeURIComponent(lesson.id)}`} className="press w-fit text-label text-me underline-offset-4 hover:underline">
                    Reread: {lesson.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Rise>
      </div>
    </>
  );
}

/** The last retakes as small columns, oldest on the left, each labelled with its score and day. */
function History({ items }: { items: QuizAttempt[] }) {
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-semibold text-ink-2">Your retakes</p>
      <ol className="flex items-end gap-3" aria-label="Your retakes, oldest first">
        {[...items].reverse().map((a) => (
          <li key={a.id} className="flex flex-col items-center gap-1" aria-label={`${a.score} of ${a.total} on ${day.format(new Date(a.takenAt))}`}>
            <span className="relative flex h-12 w-6 items-end overflow-hidden rounded-md bg-card" aria-hidden>
              <span className="w-full rounded-md bg-leaf" style={{ height: `${(a.score / Math.max(1, a.total)) * 100}%` }} />
            </span>
            <span className="font-mono text-caption text-ink-2" aria-hidden>
              {a.score}/{a.total}
            </span>
            <span className="text-caption text-muted-foreground" aria-hidden>
              {day.format(new Date(a.takenAt))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Right, to review and open as one segmented bar: where you stand, not a score. */
function Bar({ t }: { t: ReturnType<typeof tally> }) {
  const pct = (n: number) => `${(n / Math.max(1, t.total)) * 100}%`;
  return (
    <span className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="bg-leaf transition-[width] duration-(--duration-base)" style={{ width: pct(t.right) }} />
      <span className={"bg-status-due transition-[width] duration-(--duration-base)"} style={{ width: pct(t.missed) }} />
    </span>
  );
}
