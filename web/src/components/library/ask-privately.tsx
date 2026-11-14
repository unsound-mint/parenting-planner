"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck2, Check, Lock, MessageCircleHeart } from "lucide-react";
import { askPrivately, type AskResult, type AskTo } from "@/app/family/[memberId]/learn/questions/actions";
import { spring } from "@/components/joy/motion";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "Ask privately": the parent writes their own question and it lands, private,
 * where a person can answer it: the list for their next appointment, or (for
 * feelings) the topics for their next psychologist session. Never answered by
 * AI. The composer morphs into the saved state in place.
 */
export function AskPrivately({
  memberId,
  initial = "",
  feelings = false,
  compact = false,
  autoFocus = false,
}: {
  memberId: string;
  initial?: string;
  /** Offer the psychologist agenda as well as the next appointment. */
  feelings?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [to, setTo] = useState<AskTo>("appointment");
  const [result, setResult] = useState<AskResult | null>(null);
  const [pending, start] = useTransition();
  const saved = result?.ok ? result : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || pending) return;
    start(async () => setResult(await askPrivately(memberId, text, to)));
  };

  return (
    <motion.div layout transition={spring.ui} className="min-w-0">
      <AnimatePresence mode="popLayout" initial={false}>
        {saved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.ui}
            className="flex items-start gap-3 rounded-2xl bg-leaf-soft p-4"
            role="status"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf text-white">
              <Check className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-label text-leaf">
                {saved.to === "psychologist"
                  ? "Saved for your next psychologist session"
                  : saved.when
                    ? `Saved for ${saved.with ?? "your appointment"} on ${formatShortDate(saved.when.slice(0, 10))}`
                    : "Saved for your next appointment"}
              </p>
              <p className="mt-0.5 text-caption text-ink-2">
                Only you can see it.{" "}
                <Link
                  href={saved.to === "psychologist" ? `/family/${memberId}/care` : saved.appointmentId ? `/family/${memberId}/appointments/${saved.appointmentId}` : `/family/${memberId}`}
                  className="underline decoration-leaf/40 underline-offset-3 hover:decoration-leaf"
                >
                  {saved.to === "psychologist" ? "See your session topics" : "See your questions"}
                </Link>
              </p>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setText("");
                }}
                className="press mt-2 text-caption text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink"
              >
                Ask another
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-3">
            <label className="sr-only" htmlFor={`ask-${memberId}-${compact ? "c" : "f"}`}>
              Your question
            </label>
            <textarea
              id={`ask-${memberId}-${compact ? "c" : "f"}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              rows={compact ? 2 : 3}
              autoFocus={autoFocus}
              placeholder="What would you like to ask? For example: is it normal that..."
              className="w-full resize-none rounded-2xl border border-line-2 bg-card px-4 py-3 text-body outline-none placeholder:text-muted-foreground focus-visible:border-me focus-visible:ring-3 focus-visible:ring-me/20"
            />
            {feelings && (
              <div role="radiogroup" aria-label="Where it goes" className="flex flex-wrap gap-2">
                {(
                  [
                    ["appointment", "Next appointment", CalendarCheck2],
                    ["psychologist", "Psychologist session", MessageCircleHeart],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={to === value}
                    onClick={() => setTo(value)}
                    className={cn(
                      "press inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-label transition-colors duration-(--duration-fast)",
                      to === value ? "border-me bg-me-soft text-me" : "border-line bg-card text-ink-2 hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Private. A clinician answers it, not the app.
              </p>
              <button
                type="submit"
                disabled={!text.trim() || pending}
                className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-me px-5 text-label font-semibold text-white transition-opacity duration-(--duration-fast) disabled:opacity-50"
              >
                {pending ? "Saving" : to === "psychologist" ? "Add to my session" : "Add to my next visit"}
              </button>
            </div>
            {result && !result.ok && (
              <p className="text-caption text-ink-2" role="alert">
                {result.reason === "no_appointment" ? (
                  <>
                    There is no appointment on your calendar yet, so it was not saved.{" "}
                    <Link href={`/family/${memberId}/calendar`} className="underline underline-offset-3">
                      Add one in Calendar
                    </Link>
                    {feelings ? " or send it to your psychologist session." : "."}
                  </>
                ) : (
                  "That did not save. Try again in a moment."
                )}
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
