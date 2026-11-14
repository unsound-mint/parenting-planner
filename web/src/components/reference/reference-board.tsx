"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Baby, Heart, Pill, Search, Utensils, X } from "lucide-react";
import type { SafetyEntry } from "@/lib/api/types";
import { SoftCard } from "@/components/joy/soft-card";
import { Rise } from "@/components/joy/rise";
import { Input } from "@/components/ui/input";
import { ease, duration, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { ReferenceCard, questionFor, type Mode } from "./reference-card";
import { statusLook } from "./status";

type Props = { memberId: string; entries: SafetyEntry[]; asked: string[]; initialMode: Mode; helpHref: string };

const starters = ["coffee", "sushi", "ibuprofen", "soft cheese", "heartburn"];

const matches = (e: SafetyEntry, q: string) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = [e.name, e.topic, ...e.aliases].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
};

// A quick search over the reference: type, or pick a chip. Results filter in
// place (fade and a small settle, no jumps) so a thumb on a phone can follow
// what stayed and what left.
export function ReferenceBoard({ memberId, entries, asked, initialMode, helpHref }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  const [savedTexts, setSaved] = useState(() => new Set(asked));

  const topics = useMemo(() => [...new Set(entries.map((e) => e.topic))], [entries]);
  const chips = [
    { id: "all", label: "All", icon: null },
    { id: "food", label: "Foods", icon: Utensils },
    { id: "medicine", label: "Medicines", icon: Pill },
    ...topics.map((t) => ({ id: t, label: t, icon: null })),
  ];
  const shown = entries.filter((e) => (chip === "all" || chip === e.category || chip === e.topic) && matches(e, query));

  return (
    <>
      <Rise i={0}>
        <SoftCard tone="sun" hero className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 @4xl:flex-row @4xl:items-end @4xl:justify-between">
            <div className="max-w-prose">
              <h1 className="text-display">What is on your plate, or in your cabinet?</h1>
              <p className="mt-3 text-body text-ink-2">
                A quick look-up for common foods and over-the-counter medicines. It tells you what the guidance generally says, never what is right for you.
              </p>
            </div>
            <div role="group" aria-label="Which stage" className="flex shrink-0 gap-1 self-start rounded-full bg-card/80 p-1">
              {(
                [
                  ["pregnancy", "Pregnant", Baby],
                  ["breastfeeding", "Breastfeeding", Heart],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                  className={cn(
                    "press relative inline-flex h-11 items-center gap-2 rounded-full px-4 text-label transition-colors duration-150",
                    mode === id ? "text-white" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {mode === id && <motion.span layoutId="ref-mode" transition={spring.ui} className="absolute inset-0 rounded-full bg-me" />}
                  <span className="relative inline-flex items-center gap-2">
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try coffee, sushi, ibuprofen, antacid"
              aria-label="Search foods and medicines"
              className="h-14 rounded-full border-line-2 bg-card pr-12 pl-12 text-body md:text-body"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="press absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-ink">
                <X className="size-5" aria-hidden />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={chip === c.id}
                onClick={() => setChip(c.id)}
                className={cn(
                  "press inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-label transition-colors duration-150",
                  chip === c.id ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink-2 hover:border-ink-2",
                )}
              >
                {c.icon && <c.icon className="size-4" aria-hidden />}
                {c.label}
              </button>
            ))}
          </div>
        </SoftCard>
      </Rise>

      <Rise i={1}>
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="What the symbols mean">
          {Object.values(statusLook).map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-label text-ink-2">
              <span aria-hidden className={cn("flex size-7 items-center justify-center rounded-full", s.badge)}>
                <s.icon className="size-4" strokeWidth={2.4} />
              </span>
              {s.label}
            </li>
          ))}
        </ul>
      </Rise>

      <section aria-live="polite" aria-label="Results" className="min-w-0">
        <motion.ul layout className="grid gap-4 @3xl:grid-cols-2 @7xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((e) => (
              <motion.li
                key={e.id}
                layout="position"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: duration.fast, ease: ease.out } }}
                transition={{ ...spring.ui, opacity: { duration: duration.base, ease: ease.out } }}
              >
                <ReferenceCard
                  entry={e}
                  mode={mode}
                  memberId={memberId}
                  saved={savedTexts.has(questionFor(e, mode))}
                  onSaved={(text) => setSaved((s) => new Set(s).add(text))}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>

        {shown.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line-2 bg-card p-6">
            <p className="text-title">No match for that one.</p>
            <p className="mt-1 text-body text-ink-2">It may still have an answer. Your pharmacist, OB or midwife can check any food, medicine or supplement for you. Or try one of these.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setChip("all");
                    setQuery(s);
                  }}
                  className="press h-11 rounded-full border border-line-2 bg-card px-4 text-label text-ink-2 hover:border-ink-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <Rise i={2}>
        <p className="max-w-prose text-label text-muted-foreground">
          General information from the pages linked on each card, not medical advice and not a check of your own situation. Feeling unwell or worried about something you took? Call your OB or midwife now, or open{" "}
          <a href={helpHref} className="underline underline-offset-4 hover:text-foreground">
            Urgent help
          </a>
          .
        </p>
      </Rise>
    </>
  );
}
