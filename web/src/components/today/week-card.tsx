"use client";

import { useState } from "react";
import { Baby, BookOpen, ChevronDown, ListChecks, Lock, Ruler, Scale } from "lucide-react";
import type { Guide, PregnancyWeek } from "@/lib/api/types";
import { firstSentence } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SourceLink } from "@/components/joy/source-line";

const FULL_TERM = 40;
// Trimester boundaries, in completed weeks, for the ticks on the progress bar.
const TRIMESTER_ENDS = [13, 27];

// The weekly pregnancy card: where you are, how big the baby is, the one thing
// to do this week and the birth preparation modules. Everything comes from the
// card (getPregnancyWeek); the first line of "why it matters" carries the
// reason, the rest opens in place so nothing is printed twice.
// withWeek={false}: the page already shows the week (This week has it in the top
// bar), so the card starts with what to do instead of the number.
export function WeekCard({ card, withWeek = true }: { card: PregnancyWeek; withWeek?: boolean }) {
  const [more, setMore] = useState(false);
  const toGo = Math.max(0, FULL_TERM - card.week);
  const action = card.tasks[0];
  const headline = firstSentence(card.whyItMatters);
  const rest = card.whyItMatters.slice(headline.length).trim();
  const moreTasks = card.tasks.slice(1);
  const hasMore = Boolean(rest || card.development || moreTasks.length || card.questions.length);

  return (
    <section
      aria-labelledby="week-card-title"
      className={cn("rounded-2xl border border-border bg-card p-5", !withWeek && "[&>h2+*]:mt-0 [&>h2+*]:border-t-0 [&>h2+*]:pt-0")}
    >
      {!withWeek && (
        <h2 id="week-card-title" className="sr-only">
          Week {card.week}
        </h2>
      )}
      {withWeek && (
        <>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="week-card-title" className="text-label text-muted-foreground">
                Pregnancy week
              </h2>
              <p className="font-mono text-display leading-none tabular-nums">
                <span className="sr-only">Week </span>
                {card.week}
              </p>
            </div>
            <p className="pb-1 text-right text-label text-muted-foreground">{toGo === 0 ? "Full term" : `${toGo} weeks to go`}</p>
          </div>

          <div className="relative mt-4 h-2 rounded-full bg-muted" role="img" aria-label={`Week ${card.week} of ${FULL_TERM}`}>
            <span className="absolute inset-y-0 left-0 rounded-full bg-mom" style={{ width: `${Math.min(100, (card.week / FULL_TERM) * 100)}%` }} />
            {TRIMESTER_ENDS.map((w) => (
              <span key={w} className="absolute inset-y-0 w-0.5 bg-card" style={{ left: `${(w / FULL_TERM) * 100}%` }} />
            ))}
          </div>
        </>
      )}

      {card.size && (
        <div className="mt-5 flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-ok-soft text-status-ok">
            <Baby className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-title">About the size of {card.size.comparison}</p>
            <p className="mt-1 flex gap-4 font-mono text-caption text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-3.5" aria-hidden />
                {card.size.lengthCm} cm
              </span>
              <span className="inline-flex items-center gap-1">
                <Scale className="size-3.5" aria-hidden />
                {card.size.weightG} g
              </span>
            </p>
          </div>
        </div>
      )}

      {action && (
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-status-up-soft p-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-status-up">
            <ListChecks className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-label text-status-up">Do this week</p>
            <p className="text-body font-semibold">{action}</p>
          </div>
        </div>
      )}

      {headline && <p className="mt-4 text-body">{headline}</p>}

      {hasMore && (
        <>
          <button
            type="button"
            onClick={() => setMore((o) => !o)}
            aria-expanded={more}
            className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg text-label font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground md:min-h-8"
          >
            {withWeek ? `More about week ${card.week}` : "More this week"}
            <ChevronDown className={cn("size-4 transition-transform duration-220 ease-(--ease-out)", more && "rotate-180")} aria-hidden />
          </button>
          <div className={cn("grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)", more ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!more}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-4 pt-2 text-body">
                {rest && <p>{rest}</p>}
                {card.development && (
                  <p>
                    <span className="font-semibold">Developing: </span>
                    {card.development}
                  </p>
                )}
                {moreTasks.length > 0 && (
                  <ul className="list-disc pl-5">
                    {moreTasks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                {card.questions.length > 0 && (
                  <div>
                    <p className="text-label font-semibold">Ask at your next visit</p>
                    <ul className="mt-1 list-disc pl-5">
                      {card.questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {card.birthPrep.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-title">Birth preparation</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {card.birthPrep.map((g) => (
              <ModuleRow key={g.id} guide={g} />
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-caption">
        <SourceLink source={card.source} />
      </p>
    </section>
  );
}

// A birth prep module. Locked ones say when they open; open ones show their
// steps under the row.
function ModuleRow({ guide }: { guide: Guide }) {
  const [open, setOpen] = useState(false);
  if (guide.locked) {
    return (
      <li className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-muted-foreground">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Lock className="size-4" aria-hidden />
        </span>
        <span className="flex-1 text-body">{guide.title}</span>
        <span className="font-mono text-caption">{guide.unlocksAtWeek ? `Opens week ${guide.unlocksAtWeek}` : "Locked"}</span>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-muted"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-ok-soft text-status-ok">
          <BookOpen className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold">{guide.title}</span>
          {guide.minutes != null && <span className="block font-mono text-caption text-muted-foreground">{guide.minutes} min</span>}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-220 ease-(--ease-out)", open && "rotate-180")} aria-hidden />
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <ol className="list-decimal py-2 pr-2 pl-12 text-body">
            {guide.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    </li>
  );
}
