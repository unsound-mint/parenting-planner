"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import type { Lesson, Parent, QuizQuestion } from "@/lib/api/types";
import { Avatar, PartnerChip } from "@/components/joy/partner-chip";
import { SourceLine } from "@/components/joy/source-line";
import { SoftCard } from "@/components/joy/soft-card";
import { ease, spring } from "@/components/joy/motion";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Burst } from "./celebrate";
import type { Couple } from "./model";

type Props = {
  lesson: Lesson;
  couple: Couple;
  /** The next lesson in the path with a question the acting parent has not answered. */
  nextLesson?: Lesson;
  onAnswer: (q: QuizQuestion, choiceId: string) => Promise<boolean>;
  onOpenLesson: (lesson: Lesson) => void;
};

const answerOf = (q: QuizQuestion, id?: string) => (id ? q.answers.find((a) => a.memberId === id) : undefined);

/**
 * The quiz of one lesson, a question at a time. Picking an answer reveals the
 * right one, why, its source and the partner's pick (the API holds the
 * partner's choice back until you answer). The bar shows where you are in the
 * quiz, not a score: no points, no streaks (docs/design.md, rule 9).
 * Mount it with key={lesson.id} so a new lesson starts at its first open question.
 */
export function QuizCard({ lesson, couple, nextLesson, onAnswer, onOpenLesson }: Props) {
  const { me, them } = couple;
  const firstOpen = lesson.quiz.findIndex((q) => !answerOf(q, me.id));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [justBoth, setJustBoth] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const q = lesson.quiz[index];
  if (!q) return null;

  const mine = answerOf(q, me.id);
  const theirs = answerOf(q, them?.id);
  const revealed = !!mine && !!q.correctChoiceId;
  const last = index === lesson.quiz.length - 1;

  function pick(choiceId: string) {
    if (revealed || pending) return;
    setPicked(choiceId);
    startTransition(async () => {
      const ok = await onAnswer(q, choiceId);
      setPicked(null);
      if (ok && theirs) setJustBoth(q.id);
    });
  }

  return (
    <SoftCard as="section" aria-labelledby="quiz-q" className="flex flex-col gap-4">
      <div>
        <p className="truncate text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">Quiz · {lesson.title}</p>
        {lesson.quiz.length > 1 && (
          <div className="mt-2.5 flex gap-1.25" aria-label={`Question ${index + 1} of ${lesson.quiz.length}`}>
            {lesson.quiz.map((x, i) => (
              <span key={x.id} className="relative h-1.25 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className={cn(
                    "absolute inset-0 origin-left rounded-full transition-[scale,background-color] duration-(--duration-slow) ease-(--ease-out)",
                    i === index && !answerOf(x, me.id) ? "bg-me" : "bg-leaf",
                    i === index || answerOf(x, me.id) ? "[scale:1_1]" : "[scale:0_1]",
                  )}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: ease.out }}
          className="flex flex-col gap-4"
        >
          <h2 id="quiz-q" className="text-title text-balance">
            {q.prompt}
          </h2>

          {!revealed && theirs && them && (
            <PartnerChip person={them} className="self-start">
              {them.displayName} answered. Pick yours to compare.
            </PartnerChip>
          )}

          <div className="flex flex-col gap-2.5" role="group" aria-label="Answers">
            {q.choices.map((c) => {
              const right = revealed && c.id === q.correctChoiceId;
              const mineHere = mine?.choiceId === c.id || picked === c.id;
              const theirsHere = revealed && theirs?.choiceId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={revealed || pending}
                  aria-pressed={mineHere}
                  onClick={() => pick(c.id)}
                  className={cn(
                    "press flex min-h-12 items-center gap-3 rounded-2xl border-[1.5px] bg-card px-4 py-3 text-left text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                    "transition-[border-color,background-color,opacity] duration-(--duration-base) ease-(--ease-out)",
                    right ? "border-leaf bg-leaf-soft" : mineHere ? "border-me-mid" : "border-line-2",
                    !revealed && "pointer-fine:hover:border-me-mid",
                    revealed && !right && !mineHere && !theirsHere && "opacity-60",
                  )}
                >
                  <span className="flex-1">{c.text}</span>
                  {right && <Check className="size-4.5 shrink-0 text-leaf" strokeWidth={2.6} aria-label="The answer" />}
                  {revealed && mine?.choiceId === c.id && <Avatar person={me} size="sm" />}
                  {theirsHere && them && <Avatar person={them} size="sm" />}
                </button>
              );
            })}
          </div>

          <AnimatePresence initial={false}>
            {revealed && (
              <motion.div
                key="why"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.ui}
                className="flex flex-col gap-3 rounded-2xl bg-muted px-4 py-3.5"
              >
                <p className="text-body text-ink-2">{q.explanation}</p>
                <SourceLine sources={[lesson.source]} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {last ? (
                    nextLesson ? (
                      <button type="button" onClick={() => onOpenLesson(nextLesson)} className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-me px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        Next: {nextLesson.title}
                        <ArrowRight className="size-4" aria-hidden />
                      </button>
                    ) : null
                  ) : (
                    <button type="button" onClick={() => setIndex(index + 1)} className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-me px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      Next question
                      <ArrowRight className="size-4" aria-hidden />
                    </button>
                  )}
                  {them && <PartnerLine q={q} me={me} them={them} both={justBoth === q.id} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </SoftCard>
  );
}

/** How the partner answered, once you have: same pick, another pick, or not yet. */
function PartnerLine({ q, me, them, both }: { q: QuizQuestion; me: Parent; them: Parent; both: boolean }) {
  const mine = answerOf(q, me.id);
  const theirs = answerOf(q, them.id);
  const text = !theirs ? `${them.displayName} has not answered yet` : theirs.choiceId === mine?.choiceId ? `${them.displayName} picked the same answer` : `${them.displayName} picked another answer. Worth a chat.`;
  return (
    <span className="relative inline-flex items-center gap-2 text-label font-normal text-ink-2">
      {theirs && (
        <motion.span className="relative inline-flex" initial={both ? { scale: 0.6 } : false} animate={{ scale: 1 }} transition={spring.playful}>
          {both && <Burst colors={["bg-butter", roleAccent[me.role].bg, roleAccent[them.role].bg, "bg-leaf"]} radius={22} />}
          <Avatar person={them} size="sm" />
        </motion.span>
      )}
      {text}
    </span>
  );
}
