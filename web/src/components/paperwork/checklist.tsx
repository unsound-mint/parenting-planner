"use client";

import { useId, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import type { PaperworkItem } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/joy/partner-chip";
import { SourceLine } from "@/components/joy/source-line";
import { duration, ease, spring } from "@/components/joy/motion";
import { daysFrom, leftWords } from "./days";
import { Tick } from "./tick";

const basisLabel = { official: "Official deadline", suggested: "Our suggested target", anytime: "Any time" } as const;

/**
 * The checklist: open steps in deadline order, finished ones settle below. Ticking
 * moves a row down with a layout spring, so the list closes up around it instead of
 * jumping. Every row opens to why it matters and how to do it, with its sources.
 */
export function Checklist({
  items,
  today,
  people,
  nextKey,
  onToggle,
}: {
  items: PaperworkItem[];
  today: string;
  people: Person[];
  nextKey?: string;
  onToggle: (item: PaperworkItem) => void;
}) {
  const ordered = [...items.filter((i) => !i.task.done), ...items.filter((i) => i.task.done)];
  const [open, setOpen] = useState<string | undefined>(nextKey);
  return (
    <LayoutGroup>
      <ol className="flex flex-col gap-2.5">
        {ordered.map((item) => (
          <Row key={item.key} item={item} today={today} people={people} next={item.key === nextKey} open={open === item.key} onOpen={() => setOpen(open === item.key ? undefined : item.key)} onToggle={() => onToggle(item)} />
        ))}
      </ol>
    </LayoutGroup>
  );
}

function Row({ item, today, people, next, open, onOpen, onToggle }: { item: PaperworkItem; today: string; people: Person[]; next: boolean; open: boolean; onOpen: () => void; onToggle: () => void }) {
  const id = useId();
  const t = item.task;
  const owner = people.find((p) => p.id === t.assigneeId);
  const doneBy = people.find((p) => p.id === t.doneById);
  const days = t.dueOn ? daysFrom(today, t.dueOn) : undefined;
  const tone = doneBy ? roleAccent[doneBy.role].bg : owner ? roleAccent[owner.role].bg : "bg-status-ok";
  return (
    <motion.li
      layout="position"
      transition={spring.ui}
      id={`paperwork-${item.key}`}
      className={cn("scroll-mt-24 rounded-2xl border p-3.5 transition-colors duration-(--duration-base) md:p-4", t.done ? "border-line bg-muted/60" : next ? "border-primary bg-card shadow-[0_0_0_3px_var(--secondary)]" : "border-line bg-card")}
    >
      <div className="flex items-start gap-3">
        <Tick done={t.done} tone={tone} label={t.done ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`} onClick={onToggle} />
        <div className="min-w-0 flex-1">
          {next && !t.done && <p className="mb-0.5 text-caption font-semibold tracking-[0.07em] text-primary uppercase">Next step</p>}
          <button type="button" onClick={onOpen} aria-expanded={open} aria-controls={id} className="group flex min-h-11 w-full items-center gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-0">
            <span className={cn("relative text-title leading-snug transition-colors duration-(--duration-base)", t.done && "text-muted-foreground")}>
              {t.title}
              <motion.span
                aria-hidden
                className="absolute top-1/2 left-0 h-0.5 w-full origin-left rounded-full bg-muted-foreground/60"
                initial={false}
                animate={{ scaleX: t.done ? 1 : 0 }}
                transition={{ duration: duration.base, ease: ease.out }}
              />
            </span>
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base)", open && "rotate-180")} />
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption">
            {t.done && doneBy ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Avatar person={doneBy} size="sm" />
                {doneBy.displayName} ticked this
              </span>
            ) : (
              <>
                {t.dueOn && days !== undefined && (
                  <span className={cn("rounded-md px-2 py-0.5 font-mono", days >= 0 && days <= 14 ? "bg-status-due-soft text-status-due" : "bg-muted text-muted-foreground")}>
                    {formatShortDate(t.dueOn)} · <span className="font-sans font-semibold">{leftWords(days)}</span>
                  </span>
                )}
                {owner && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Avatar person={owner} size="sm" />
                    {owner.displayName}
                  </span>
                )}
              </>
            )}
            <span className="text-muted-foreground">{basisLabel[item.basis]}</span>
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-3 pl-[44px] text-body">
              <p className="text-ink-2">{item.why}</p>
              <ol className="flex flex-col gap-1.5">
                {item.how.map((step, n) => (
                  <li key={step} className="flex gap-2.5 text-ink-2">
                    <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sun font-mono text-caption text-ink">
                      {n + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {t.source && <SourceLine sources={[t.source, ...item.moreSources]} />}
              <a href={t.source?.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-label text-primary underline-offset-3 hover:underline">
                Open the official page <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
