"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { saveQuizAttempt } from "@/app/family/[memberId]/learn/actions";
import { SoftCard } from "@/components/joy/soft-card";
import type { QuizAttempt, QuizQuestion } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * A retake of a whole deck, a question at a time. The right choice and the
 * reason are already known (the parent answered every question once on
 * Learn), so each pick reveals at once; the server grades the full set when
 * it is sent and keeps the attempt. First answers stay untouched for the couple.
 */
export function QuizRetake({
  memberId,
  deckId,
  questions,
  onDone,
  onCancel,
}: {
  memberId: string;
  deckId: string;
  questions: QuizQuestion[];
  onDone: (a: QuizAttempt) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const q = questions[index];
  if (!q) return null;
  const picked = picks[q.id];
  const last = index === questions.length - 1;

  function finish() {
    start(async () => {
      const res = await saveQuizAttempt(
        memberId,
        deckId,
        questions.map((x) => ({ questionId: x.id, choiceId: picks[x.id] })),
      );
      if (res.ok) onDone(res.data);
      else toast.error("Could not save this retake. Please try again.");
    });
  }

  return (
    <SoftCard as="section" aria-labelledby="retake-q" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-semibold tracking-wider text-ink-2 uppercase">
          Retake · {index + 1} of {questions.length}
        </p>
        <button type="button" onClick={onCancel} className="press min-h-11 rounded-full px-3 text-label text-ink-2 hover:bg-muted">
          Stop
        </button>
      </div>
      <div className="flex gap-1" aria-hidden>
        {questions.map((x, i) => (
          <span key={x.id} className={cn("h-1.5 flex-1 rounded-full", i < index || (i === index && picked) ? "bg-me" : "bg-muted")} />
        ))}
      </div>
      <h3 id="retake-q" className="text-title text-balance">
        {q.prompt}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {q.choices.map((c) => {
          const isPicked = picked === c.id;
          const isRight = !!picked && c.id === q.correctChoiceId;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!!picked}
                onClick={() => setPicks((p) => ({ ...p, [q.id]: c.id }))}
                className={cn(
                  "press flex min-h-12 w-full items-center justify-between gap-3 rounded-full border px-4 text-left text-body transition-colors duration-(--duration-fast)",
                  isRight ? "border-leaf bg-leaf-soft" : isPicked ? "border-status-due bg-status-due-soft" : "border-line-2 bg-card hover:border-ink-2",
                  picked && !isRight && !isPicked && "opacity-60",
                )}
              >
                {c.text}
                {isRight && <Check className="size-4.5 shrink-0 text-leaf" aria-label="Right answer" />}
                {isPicked && !isRight && <X className="size-4.5 shrink-0 text-status-due" aria-label="Your pick" />}
              </button>
            </li>
          );
        })}
      </ul>
      {picked && q.explanation && <p className="text-label font-normal text-ink-2">{q.explanation}</p>}
      {picked && (
        <button
          type="button"
          disabled={pending}
          onClick={() => (last ? finish() : setIndex((i) => i + 1))}
          className="press inline-flex min-h-11 w-fit items-center rounded-full bg-me px-4.5 text-label font-semibold text-white disabled:opacity-60"
        >
          {last ? (pending ? "Saving..." : "See my score") : "Next question"}
        </button>
      )}
    </SoftCard>
  );
}
