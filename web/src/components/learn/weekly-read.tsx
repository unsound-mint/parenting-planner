"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Undo2 } from "lucide-react";
import type { WeeklyRead, WeeklyReadKind } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { spring } from "@/components/joy/motion";

const unit: Record<WeeklyReadKind, string> = {
  planning: "For now",
  pregnancy_week: "This week",
  baby_week: "This week",
  month: "This month",
  year: "This year",
};

function when(r: WeeklyRead): string | undefined {
  if (!r.startsOn) return undefined;
  if (!r.endsOn) return `from ${formatShortDate(r.startsOn)}`;
  return `${formatShortDate(r.startsOn)} to ${formatShortDate(r.endsOn)}`;
}

/** "Week 25 of pregnancy", "Week 6", "14 months", "Age 4". */
function heading(r: WeeklyRead): string {
  if (r.kind === "pregnancy_week") return `${r.label} of pregnancy`;
  return r.kind === "baby_week" && r.label.startsWith("Week") ? `${r.label} with your baby` : r.label;
}

/**
 * This week's read on Learn: a short piece for the family's exact week of
 * pregnancy, week of the first year, month or year, with the public pages it
 * comes from to read on. The arrows browse the weeks before and after without
 * a request (the whole track arrives at once); "Back to this week" returns.
 * The demo clock moves `current` on the server.
 */
export function WeeklyReadCard({ items, current }: { items: WeeklyRead[]; current: number }) {
  const [at, setAt] = useState(current);
  const [dir, setDir] = useState(1);
  const read = items[at];
  if (!read) return null;
  const prev = items[at - 1];
  const next = items[at + 1];
  const isNow = at === current;
  const go = (to: number) => {
    setDir(to > at ? 1 : -1);
    setAt(to);
  };
  const dates = when(read);

  return (
    <section aria-labelledby="weekly-read-title" className="relative overflow-hidden rounded-[2rem] bg-sun p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="flex flex-wrap items-baseline gap-x-2 text-label">
          <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-semibold tracking-wide uppercase", isNow ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
            {isNow ? unit[read.kind] : at > current ? "Ahead" : "Earlier"}
          </span>
          <span className="font-semibold">{heading(read)}</span>
          {dates && <span className="font-mono text-caption text-muted-foreground">{dates}</span>}
        </p>
        <nav aria-label="Browse the weeks" className="flex items-center gap-2">
          {!isNow && (
            <button type="button" onClick={() => go(current)} className="press inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-label text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-card hover:text-foreground">
              <Undo2 aria-hidden className="size-4" />
              Back to {unit[items[current]?.kind ?? read.kind].toLowerCase()}
            </button>
          )}
          <NavButton label={prev ? prev.label : undefined} onClick={() => prev && go(at - 1)} side="prev" />
          <NavButton label={next ? next.label : undefined} onClick={() => next && go(at + 1)} side="next" />
        </nav>
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={read.id}
          custom={dir}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: 24 * d }),
            center: { opacity: 1, x: 0 },
            exit: (d: number) => ({ opacity: 0, x: -24 * d }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring.ui}
          className="mt-5"
        >
          <div className="min-w-0">
            <h2 id="weekly-read-title" className="text-headline text-balance">
              {read.title}
            </h2>
            <p className="mt-3 max-w-prose text-body text-ink-2">{read.body}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function NavButton({ label, onClick, side }: { label?: string; onClick: () => void; side: "prev" | "next" }) {
  const Icon = side === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!label}
      aria-label={label ? `${side === "prev" ? "Previous" : "Next"}: ${label}` : side === "prev" ? "No earlier read" : "No later read"}
      className="press inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-3 text-label transition-colors duration-(--duration-fast) hover:bg-card/70 disabled:pointer-events-none disabled:opacity-40"
    >
      {side === "prev" && <Icon aria-hidden className="size-4" />}
      <span className="hidden sm:inline">{label ?? (side === "prev" ? "Earlier" : "Later")}</span>
      {side === "next" && <Icon aria-hidden className="size-4" />}
    </button>
  );
}
