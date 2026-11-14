"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { BenefitsFinder } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { SourceLine } from "@/components/joy/source-line";
import { duration, ease, spring, tap } from "@/components/joy/motion";

type Answers = Record<string, boolean>;

/**
 * The benefits finder: a few yes or no questions, no income figures, and nothing
 * is saved (the server answers from the choices and forgets them). It points at
 * the official programs worth a look and never says the family qualifies.
 */
export function BenefitsFinderCard({ finder, memberId }: { finder: BenefitsFinder; memberId: string }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function answer(id: string, yes: boolean) {
    const next = { ...answers };
    if (next[id] === yes) delete next[id];
    else next[id] = yes;
    setAnswers(next);
    const { data, error } = await api.POST("/members/{memberId}/family-paperwork/benefits", { params: { path: { memberId } }, body: { answers: next } });
    if (error || !data) {
      toast.error("Could not check that. Please try again.");
      return;
    }
    setReasons(Object.fromEntries(data.items.map((h) => [h.programId, h.reason])));
  }

  const asked = Object.keys(answers).length > 0;
  return (
    <section aria-labelledby="benefits-title" className="rounded-3xl border border-line bg-card p-5.5 md:p-7">
      <h2 id="benefits-title" className="text-headline">
        Help that may be worth a look
      </h2>
      <p className="mt-1 text-label text-muted-foreground">Three questions. We do not ask for income numbers and we do not save your answers. Only the agency can tell you whether you qualify.</p>
      <div className="mt-4 flex flex-col gap-2">
        {finder.questions.map((q) => (
          <div key={q.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-muted/60 px-4 py-2.5">
            <p id={`q-${q.id}`} className="min-w-0 flex-1 basis-56 text-body">
              {q.text}
            </p>
            <div role="group" aria-labelledby={`q-${q.id}`} className="flex gap-1.5">
              {[true, false].map((yes) => (
                <motion.button
                  key={String(yes)}
                  type="button"
                  aria-pressed={answers[q.id] === yes}
                  onClick={() => answer(q.id, yes)}
                  whileTap={tap}
                  className={cn(
                    "min-h-11 min-w-16 rounded-full px-4 text-label font-medium transition-colors duration-(--duration-fast) outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    answers[q.id] === yes ? "bg-ink text-paper" : "bg-card text-ink-2 hover:bg-line",
                  )}
                >
                  {yes ? "Yes" : "No"}
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 text-label text-muted-foreground">
        {!asked ? "Answer any question and the programs to look at light up." : Object.keys(reasons).length === 0 ? "Nothing stands out from those answers. The programs are still listed below." : `${Object.keys(reasons).length} to look at.`}
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {[...finder.programs].sort((a, b) => Number(!!reasons[b.id]) - Number(!!reasons[a.id])).map((p) => {
          const on = !!reasons[p.id];
          return (
            <motion.li
              key={p.id}
              layout="position"
              transition={spring.ui}
              animate={{ backgroundColor: on ? "var(--leaf-soft)" : "var(--card)" }}
              className="rounded-2xl border border-line p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-title">{p.name}</h3>
                <motion.span
                  initial={false}
                  animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.9 }}
                  transition={{ duration: duration.fast, ease: ease.out }}
                  className="rounded-full bg-leaf px-2.5 py-0.5 text-caption font-semibold text-white"
                  aria-hidden={!on}
                >
                  Worth a look
                </motion.span>
              </div>
              {on && <p className="mt-1 text-label text-ink-2">{reasons[p.id]}</p>}
              <p className="mt-1.5 text-body text-ink-2">{p.what}</p>
              <p className="mt-1 text-label">
                <span className="font-medium">Where to apply:</span> {p.where}
              </p>
              <SourceLine sources={[p.source, ...p.moreSources]} className="mt-2" />
            </motion.li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-sun/60 p-4">
        <Search aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-body">{finder.finderText}</p>
          <a href={finder.finderSource.url} target="_blank" rel="noopener" className="mt-1 inline-flex min-h-11 items-center gap-1 text-label font-medium underline underline-offset-3 md:min-h-0">
            Open the benefit finder <ExternalLink aria-hidden className="size-3.5" />
          </a>
          <SourceLine sources={[finder.finderSource]} className="mt-1" />
        </div>
      </div>
    </section>
  );
}
