"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { MoodCheckin } from "@/lib/api/types";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { MoodFace, MOODS, type Mood } from "@/components/joy/mood-face";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
const RANGES = [
  { id: "1m", label: "1 month", days: 30 },
  { id: "6m", label: "6 months", days: 182 },
  { id: "1y", label: "1 year", days: 365 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];
const LEVELS: Mood[] = [5, 4, 3, 2, 1];

type Bucket = { start: string; mood?: number; sleep?: number; n: number };

/** Percent from the top for a mood of 1 to 5. */
const y = (mood: number) => ((5 - mood) / 4) * 100;

/** The Monday on or before a UTC day, as YYYY-MM-DD. */
function mondayOf(ms: number): string {
  const d = new Date(ms);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

/**
 * The acting parent's own check-ins over a month, six months or a year: mood as
 * a line on the faces, sleep as bars under it. A month shows each day; longer
 * ranges average each week so the shape of the season shows, not the noise.
 * The hardest weeks are named under it with their dates, so a parent can look
 * back ("that was when nights were worst") without reading every entry. Only
 * their own check-ins: the partner's shared ones stay in the partner's view.
 * One request for the year (GET mood-checkins?since=), sliced by range here.
 */
export function MoodHistory({ memberId, now }: { memberId: string; now: string }) {
  const [range, setRange] = useState<RangeId>("6m");
  const [items, setItems] = useState<MoodCheckin[] | null>(null);
  const end = Date.parse(now);

  useEffect(() => {
    const since = new Date(end - 365 * DAY).toISOString().slice(0, 10);
    let live = true;
    api.GET("/members/{memberId}/mood-checkins", { params: { path: { memberId }, query: { since } } }).then(({ data }) => {
      if (live) setItems((data?.items ?? []).filter((c) => c.authorId === memberId));
    });
    return () => {
      live = false;
    };
    // The year is fetched once per parent and day; the range only slices it.
  }, [memberId, end]);

  if (items === null) return <div aria-busy className="h-72 animate-pulse rounded-3xl bg-muted" />;
  if (items.length === 0) return null;

  const days = RANGES.find((r) => r.id === range)!.days;
  const weekly = range !== "1m";
  const from = end - days * DAY;
  const buckets: Bucket[] = [];
  const index = new Map<string, Bucket>();
  const step = weekly ? 7 : 1;
  for (let t = weekly ? Date.parse(mondayOf(from)) : from; t <= end; t += step * DAY) {
    const b: Bucket = { start: new Date(t).toISOString().slice(0, 10), n: 0 };
    buckets.push(b);
    index.set(b.start, b);
  }
  const sums = new Map<string, { mood: number; sleep: number; n: number }>();
  for (const c of items) {
    const t = Date.parse(c.recordedAt);
    if (t < from || t > end) continue;
    const key = weekly ? mondayOf(t) : c.recordedAt.slice(0, 10);
    if (!index.has(key)) continue;
    const s = sums.get(key) ?? { mood: 0, sleep: 0, n: 0 };
    sums.set(key, { mood: s.mood + c.mood, sleep: s.sleep + c.sleepHours, n: s.n + 1 });
  }
  for (const b of buckets) {
    const s = sums.get(b.start);
    if (s) Object.assign(b, { mood: s.mood / s.n, sleep: s.sleep / s.n, n: s.n });
  }

  const n = buckets.length;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const segments: string[] = [];
  let run: string[] = [];
  buckets.forEach((b, i) => {
    if (b.mood === undefined) {
      if (run.length > 1) segments.push(run.join(" "));
      run = [];
      return;
    }
    run.push(`${x(i)},${y(b.mood)}`);
  });
  if (run.length > 1) segments.push(run.join(" "));

  const filled = buckets.filter((b) => b.mood !== undefined);
  const hardest = weekly
    ? [...filled]
        .filter((b) => (b.mood ?? 5) < 2.5)
        .sort((a, b) => (a.mood ?? 0) - (b.mood ?? 0))
        .slice(0, 3)
    : [];
  const word = (m: number) => MOODS[Math.round(m) as Mood].label.toLowerCase();
  const unit = weekly ? "week" : "day";
  const tick = Math.max(1, Math.round(n / (weekly ? 6 : 5)));

  return (
    <section aria-labelledby="mood-history-title" className="rounded-3xl border border-line bg-card p-4.5 md:px-6 md:py-5.5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="mood-history-title" className="text-title font-semibold">
            Your mood over time
          </h2>
          <p className="text-caption text-muted-foreground">
            {weekly ? "Each point is a week's average" : "Each point is a day"} of your own check-ins. {filled.length} of {n} {unit}s have one.
          </p>
        </div>
        <div role="radiogroup" aria-label="Range" className="flex rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={range === r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "min-h-9 rounded-full px-3.5 text-label outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                range === r.id ? "bg-card font-semibold text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-[1.5rem_1fr] gap-x-2.5">
        <div aria-hidden className="relative h-32 md:h-36">
          {LEVELS.map((m) => (
            <span key={m} className="absolute left-0 -translate-y-1/2" style={{ top: `${y(m)}%` }}>
              <MoodFace mood={m} className="size-5" />
            </span>
          ))}
        </div>
        <div className="relative h-32 md:h-36">
          {LEVELS.map((m) => (
            <span key={m} aria-hidden className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${y(m)}%` }} />
          ))}
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {segments.map((pts) => (
              <polyline key={pts} points={pts} fill="none" stroke="var(--color-me)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {buckets.map((b, i) =>
            b.mood === undefined ? null : (
              <span
                key={b.start}
                title={`${weekly ? "Week of " : ""}${formatLongDate(b.start)}: ${word(b.mood)}, ${b.sleep?.toFixed(1)} h sleep`}
                className={cn("absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-me ring-3 ring-card", hardest.includes(b) && "size-3 bg-ink-2")}
                style={{ left: `${x(i)}%`, top: `${y(b.mood)}%` }}
              />
            ),
          )}
        </div>

        {/* Sleep, 0 to 10 hours, as calm bars under the mood. */}
        <span aria-hidden className="mt-3 text-right font-mono text-caption text-muted-foreground">
          h
        </span>
        <div aria-hidden className="mt-3 flex h-10 items-end gap-px border-b border-line">
          {buckets.map((b) => (
            <span key={b.start} className="flex-1 rounded-t-sm bg-them-soft" style={{ height: `${Math.min(100, ((b.sleep ?? 0) / 10) * 100)}%` }} />
          ))}
        </div>

        <span aria-hidden />
        <div aria-hidden className="relative mt-1 h-4 font-mono text-caption text-muted-foreground">
          {buckets.map((b, i) =>
            i % tick === 0 ? (
              <span key={b.start} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>
                {formatShortDate(b.start)}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-me" />
          How you felt
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2 rounded-t-sm bg-them-soft" />
          Hours slept
        </li>
      </ul>

      {hardest.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="text-label font-semibold">The hardest weeks</h3>
          <ul className="mt-1.5 grid gap-1.5 @3xl:grid-cols-3">
            {hardest.map((b) => (
              <li key={b.start} className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2">
                <MoodFace mood={Math.round(b.mood!) as Mood} className="size-6" />
                <span className="min-w-0 text-label">
                  Week of {formatShortDate(b.start)}
                  <span className="block font-mono text-caption text-muted-foreground">
                    {word(b.mood!)} · {b.sleep?.toFixed(1)} h sleep · {b.n} check-in{b.n === 1 ? "" : "s"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
