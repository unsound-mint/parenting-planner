import { CalendarClock, Info, Stethoscope } from "lucide-react";
import type { FertilityEntry, FertilityOverview } from "@/lib/api/types";
import { daysBetween, relativeDays } from "@/lib/fertility";
import { formatShortDate } from "@/lib/format";
import { SoftCard } from "@/components/joy/soft-card";
import { CycleRing } from "./cycle-ring";

/** What the ring and the headline say today; shared with the This week card. */
export function cycleState(overview: FertilityOverview, entries: FertilityEntry[], today: string) {
  const current = overview.cycles.at(-1);
  const est = overview.estimate;
  const day = overview.cycleDay ?? 1;
  const length = est?.averageCycleDays ?? 28;
  const periodDays = current ? Math.max(entries.filter((e) => e.kind === "period" && e.code !== "spotting" && daysBetween(current.startDate, e.date) >= 0 && daysBetween(current.startDate, e.date) < 10).length, 1) : 5;
  const win = est && current ? { start: daysBetween(current.startDate, est.windowStart) + 1, end: daysBetween(current.startDate, est.windowEnd) + 1, ovulation: daysBetween(current.startDate, est.ovulation) + 1 } : undefined;
  let headline = "Log your period to start your cycle.";
  let caption = "no period logged";
  if (current && !est) {
    const need = overview.cyclesNeeded ?? 2;
    headline = `Log ${need === 1 ? "one more full cycle" : "two full cycles"} and we will estimate your fertile window.`;
    caption = "learning your cycle";
  } else if (est) {
    const toStart = daysBetween(today, est.windowStart);
    const toEnd = daysBetween(today, est.windowEnd);
    if (toStart > 0) {
      headline = `Your estimated fertile window starts ${relativeDays(toStart)}.`;
      caption = `window ${formatShortDate(est.windowStart)} to ${formatShortDate(est.windowEnd)}`;
    } else if (toEnd >= 0) {
      headline = "You are probably in your fertile window.";
      caption = `estimate, until ${formatShortDate(est.windowEnd)}`;
    } else {
      headline = `Your next period is expected around ${formatShortDate(est.nextPeriod)}.`;
      caption = "window has passed";
    }
  }
  return { day, length, periodDays, win, headline, caption, est };
}

/**
 * The top of the fertility journal: the cycle ring, one sentence about where you are, and
 * the honest label. Estimates carry how far they can move (the spread of your own cycles),
 * a source and the date it was checked.
 */
export function CycleHero({ overview, entries, today }: { overview: FertilityOverview; entries: FertilityEntry[]; today: string }) {
  const s = cycleState(overview, entries, today);
  const { clinician: c, estimate: est } = overview;
  return (
    <SoftCard tone="leaf" hero className="flex flex-col gap-6 @4xl:flex-row @4xl:items-center">
      <CycleRing length={s.length} day={s.day} periodDays={s.periodDays} window={s.win} caption={s.caption} className="shrink-0" />
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="max-w-xl text-headline text-balance">{s.headline}</h1>
        <p className="flex max-w-xl items-start gap-2 text-label font-normal text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            An estimate, not a promise.{" "}
            {est
              ? `It comes from your last ${est.cyclesUsed} cycles, which ran ${est.shortestCycleDays} to ${est.longestCycleDays} days${est.spreadDays > 0 ? `, so the dates can move by about ${est.spreadDays} ${est.spreadDays === 1 ? "day" : "days"}` : ""}. Ovulation is about 14 days before the next period; you can get pregnant from 5 days before ovulation to 1 day after.`
              : "It needs at least two full cycles of your own."}
          </span>
        </p>
        {est && (
          <p className="flex items-center gap-2 text-label font-normal text-ink-2">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            Next period around {formatShortDate(est.nextPeriod)}, in {daysBetween(today, est.nextPeriod)} days
          </p>
        )}
        {c.suggest && (
          <p className="flex max-w-xl items-start gap-2 rounded-2xl bg-card p-3.5 text-label font-normal">
            <Stethoscope className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              You have been trying for {c.monthsTrying} months. An evaluation is suggested after {c.thresholdMonths === 6 ? "6 months when you are older than 35" : "1 year of regular unprotected sex"}. Ask your doctor, and bring this chart.
            </span>
          </p>
        )}
      </div>
    </SoftCard>
  );
}

