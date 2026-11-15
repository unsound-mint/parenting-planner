"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Manual } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { duration, ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { ManualScene } from "./scenes";

/**
 * A manual played step by step: a big illustration, one or two sentences, a
 * "Watch for" note where the step has one. Arrow keys and swipes move between
 * steps. After the last step comes a short self-check; answering it records
 * the manual as done for this person (PUT .../completion). The check explains
 * a wrong tap in place and never scores.
 */
export function ManualPlayer({ manual, memberId, initialStep = 0 }: { manual: Manual; memberId: string; initialStep?: number }) {
  const steps = manual.steps.length;
  const [index, setIndex] = useState(initialStep);
  const [dir, setDir] = useState(1);
  const atCheck = index === steps;

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(steps, to));
      setDir(next >= index ? 1 : -1);
      setIndex(next);
    },
    [index, steps],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60 || info.velocity.x < -400) go(index + 1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(index - 1);
  }

  const step = manual.steps[Math.min(index, steps - 1)];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/family/${memberId}/simulator`} className="inline-flex min-h-11 items-center gap-1.5 text-label text-muted-foreground hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          Practice
        </Link>
        <Dots total={steps + 1} index={index} onPick={go} />
      </div>

      <div className="grid min-w-0 gap-6 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:items-center @4xl:gap-10">
        <motion.div
          className="relative aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-3xl border border-border bg-paper"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={onDragEnd}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={atCheck ? "check" : step.scene}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: duration.slow, ease: ease.out }}
              className="absolute inset-0 p-4 md:p-8"
            >
              <ManualScene scene={atCheck ? manual.steps[steps - 1].scene : step.scene} className="size-full" />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="flex min-w-0 flex-col gap-5" aria-live="polite">
          {atCheck ? (
            <SelfCheck manual={manual} memberId={memberId} onRestart={() => go(0)} />
          ) : (
            <>
              <div>
                <p className="font-mono text-caption text-muted-foreground">
                  Step {index + 1} of {steps}
                </p>
                <h2 className="mt-1 text-headline text-balance">{step.title}</h2>
                <p className="mt-3 max-w-prose text-body">{step.text}</p>
              </div>
              {step.watch && (
                <div className="flex gap-3 rounded-2xl border border-status-due/40 bg-status-due-soft p-4">
                  <Eye className="mt-0.5 size-5 shrink-0 text-status-due" aria-hidden />
                  <div>
                    <p className="text-label text-status-due">Watch for</p>
                    <p className="mt-0.5 text-body text-ink">{step.watch}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => go(index - 1)} disabled={index === 0} className="press h-11 gap-2 rounded-full px-4.5 text-label">
                  <ArrowLeft className="size-4" aria-hidden />
                  Back
                </Button>
                <Button type="button" onClick={() => go(index + 1)} className="press h-11 gap-2 rounded-full px-5 text-label">
                  {index === steps - 1 ? "Check yourself" : "Next"}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <span className="hidden text-caption text-muted-foreground md:inline">or use the arrow keys</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Dots({ total, index, onPick }: { total: number; index: number; onPick: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Steps">
      {Array.from({ length: total }, (_, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-label={i === total - 1 ? "Self-check" : `Step ${i + 1}`}
            aria-current={i === index ? "step" : undefined}
            className="flex size-6 items-center justify-center"
          >
            <motion.span
              className={cn("block h-2 rounded-full", i <= index ? "bg-primary" : "bg-line-2")}
              animate={{ width: i === index ? 22 : 8 }}
              transition={spring.ui}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}

function SelfCheck({ manual, memberId, onRestart }: { manual: Manual; memberId: string; onRestart: () => void }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [doneAt, setDoneAt] = useState(manual.completedAt);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allRight = manual.check.every((q) => picked[q.id] === q.correctChoice);

  function finish() {
    startTransition(async () => {
      const { data, error } = await api.PUT("/members/{memberId}/manuals/{manualId}/completion", {
        params: { path: { memberId, manualId: manual.id } },
      });
      if (error || !data) {
        toast.error("Could not save. Please try again.");
        return;
      }
      setDoneAt(data.completedAt);
      // The Practice cards read completion on the server; refresh so "Practised" shows on the way back.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-caption text-muted-foreground">Self-check</p>
        <h2 className="mt-1 text-headline text-balance">{doneAt ? "You can do this" : "Quick check before you go"}</h2>
      </div>
      <ul className="flex flex-col gap-4">
        {manual.check.map((q) => {
          const choice = picked[q.id];
          return (
            <li key={q.id}>
              <p className="text-body font-medium">{q.prompt}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.choices.map((c) => {
                  const chosen = choice === c.id;
                  const right = c.id === q.correctChoice;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPicked((p) => ({ ...p, [q.id]: c.id }))}
                      aria-pressed={chosen}
                      className={cn(
                        "press inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label transition-colors",
                        !chosen && "border-border bg-card hover:border-line-2",
                        chosen && right && "border-leaf bg-leaf-soft text-ink",
                        chosen && !right && "border-line-2 bg-muted text-ink",
                      )}
                    >
                      {chosen && right && <Check className="size-4" aria-hidden />}
                      {c.text}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence initial={false}>
                {choice && choice !== q.correctChoice && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: duration.base, ease: ease.out }}
                    className="mt-1.5 overflow-hidden text-label font-normal text-muted-foreground"
                  >
                    Not quite. Try the other one, or step back through the manual.
                  </motion.p>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {doneAt ? (
          <motion.p initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.playful} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-leaf-soft px-4 text-label text-ink">
            <Check className="size-4" aria-hidden />
            Practised
          </motion.p>
        ) : (
          <Button type="button" onClick={finish} disabled={!allRight || pending} className="press h-11 gap-2 rounded-full px-5 text-label">
            <Check className="size-4" aria-hidden />
            {pending ? "Saving..." : "I can do this"}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onRestart} className="press h-11 gap-2 rounded-full px-4.5 text-label">
          <RotateCcw className="size-4" aria-hidden />
          Go through again
        </Button>
      </div>
    </div>
  );
}
