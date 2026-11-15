"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, X } from "lucide-react";
import type { LearningPath, Lesson, QuizQuestion } from "@/lib/api/types";
import { ReadCover } from "@/components/week/read-cover";
import { Reader, type Talked } from "./lesson-list";
import { QuizCard } from "./quiz-card";
import { lessonState, type Couple } from "./model";

type Props = {
  path: LearningPath;
  /** The open lesson; undefined closes the sheet. */
  lesson?: Lesson;
  couple: Couple;
  justFinished: Set<string>;
  /** The path's title when the last finish completed it for both parents. */
  pathParty?: string;
  talked: Talked;
  helpHref: string;
  onClose: () => void;
  onOpen: (lesson: Lesson) => void;
  onMark: (lesson: Lesson, finished: boolean) => void;
  onTalked: (promptId: string) => void;
  onAnswer: (q: QuizQuestion, choiceId: string) => Promise<boolean>;
};

/**
 * One lesson in a focused reading view: a side sheet on wide screens, the
 * whole screen on phones. The body, its source, the talk prompt, the quiz and
 * the next lesson, so a parent can read a path start to end without leaving it.
 */
export function LessonSheet({ path, lesson, couple, justFinished, pathParty, talked, helpHref, onClose, onOpen, onMark, onTalked, onAnswer }: Props) {
  // Keep the last lesson on screen while the sheet slides out.
  const [shown, setShown] = useState(lesson);
  if (lesson && lesson !== shown) setShown(lesson);
  const l = lesson ?? shown;
  const i = l ? path.lessons.findIndex((x) => x.id === l.id) : -1;
  const next = i >= 0 ? path.lessons[i + 1] : undefined;
  const state = l ? lessonState(l, path, couple.me) : undefined;

  return (
    <Dialog.Root open={!!lesson} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-(--duration-slow) ease-(--ease-out) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-background text-foreground outline-none transition-transform duration-(--duration-enter) ease-(--ease-drawer) data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none md:inset-y-3 md:right-3 md:left-auto md:w-[min(46rem,calc(100vw-1.5rem))] md:rounded-[1.75rem] md:shadow-2xl md:data-[ending-style]:translate-x-[calc(100%+1rem)] md:data-[ending-style]:translate-y-0 md:data-[starting-style]:translate-x-[calc(100%+1rem)] md:data-[starting-style]:translate-y-0">
          {l && (
            <>
              <div className="relative h-36 shrink-0 overflow-hidden md:h-44">
                <ReadCover pathId={l.pathId} lessonId={l.id} index={i} />
                <Dialog.Close
                  aria-label="Close"
                  className="press absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex size-11 items-center justify-center rounded-full bg-card/90 text-ink-2 shadow-[0_1px_3px_rgb(0_0_0/0.1)] outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-5" aria-hidden />
                </Dialog.Close>
              </div>
              <div className="flex flex-col gap-6 px-5 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] md:px-9 md:pt-7">
                <div>
                  <p className="font-mono text-caption text-muted-foreground">
                    {path.title} · {i + 1} of {path.lessons.length} · {l.minutes} min
                  </p>
                  <Dialog.Title className="mt-1.5 text-headline text-pretty">{l.title}</Dialog.Title>
                </div>

                <Reader
                  key={l.id}
                  lesson={l}
                  couple={couple}
                  finished={state === "done"}
                  celebrate={justFinished.has(l.id)}
                  bothDone={justFinished.has(l.id) ? pathParty : undefined}
                  talked={talked}
                  helpHref={helpHref}
                  onMark={onMark}
                  onTalked={onTalked}
                />

                {l.quiz.length > 0 && <QuizCard key={`quiz-${l.id}`} lesson={l} couple={couple} onAnswer={onAnswer} onOpenLesson={onOpen} />}

                {next && (
                  <button
                    type="button"
                    onClick={() => onOpen(next)}
                    className="press group flex items-center gap-4 rounded-3xl border border-line bg-card p-3 pr-5 text-left outline-none hover:border-line-2 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="block h-16 w-24 shrink-0 overflow-hidden rounded-2xl">
                      <ReadCover pathId={next.pathId} lessonId={next.id} index={path.lessons.indexOf(next)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">Next lesson · {next.minutes} min</span>
                      <span className="mt-0.5 block text-title text-pretty">{next.title}</span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 text-ink-2 transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
                  </button>
                )}
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
