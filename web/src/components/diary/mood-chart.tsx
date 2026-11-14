"use client";

import { HeartHandshake, Star } from "lucide-react";
import type { DiaryEntry, MoodCheckin } from "@/lib/api/types";
import { dayKey, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { MoodFace, MOODS, type Mood } from "@/components/joy/mood-face";
import { cn } from "@/lib/utils";

const DAYS = 28;
const LEVELS: Mood[] = [5, 4, 3, 2, 1];

type Day = { key: string; iso: string; mood?: number; entries: DiaryEntry[] };

/** Percent from the top for a mood of 1 to 5: 5 at the top, 1 at the bottom. */
const y = (mood: number) => ((5 - mood) / 4) * 100;

/**
 * Four weeks of the parent's own journal at a glance: one point per day for
 * how they felt (their check-ins and the faces on their entries, averaged),
 * the line broken where a day has nothing, and under it a lane with each
 * entry, a star for a first and the partner's colour for one they shared.
 * Each entry marker jumps to the entry. Only the acting parent's own data:
 * the partner's shared entries stay in the list, not in this picture.
 * Points are HTML on a percentage grid so they stay round at any width; the
 * line is an SVG stretched under them with a non-scaling stroke.
 */
export function MoodChart({
  memberId,
  now,
  entries,
  checkins,
  onJump,
}: {
  memberId: string;
  now: string;
  entries: DiaryEntry[];
  checkins: MoodCheckin[];
  onJump: (entryId: string) => void;
}) {
  const end = new Date(now);
  const days: Day[] = [];
  const index = new Map<string, Day>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const iso = new Date(end.getTime() - i * 86_400_000).toISOString();
    const d: Day = { key: dayKey(iso), iso, entries: [] };
    days.push(d);
    index.set(d.key, d);
  }
  const sums = new Map<string, { sum: number; n: number }>();
  const add = (iso: string, mood: number) => {
    const k = dayKey(iso);
    if (!index.has(k)) return;
    const s = sums.get(k) ?? { sum: 0, n: 0 };
    sums.set(k, { sum: s.sum + mood, n: s.n + 1 });
  };
  for (const c of checkins) if (c.authorId === memberId) add(c.recordedAt, c.mood);
  const own = entries.filter((e) => e.authorId === memberId);
  for (const e of own) {
    if (e.mood) add(e.writtenAt, e.mood);
    index.get(dayKey(e.writtenAt))?.entries.push(e);
  }
  for (const d of days) {
    const s = sums.get(d.key);
    if (s) d.mood = s.sum / s.n;
    d.entries.sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
  }

  const logged = days.filter((d) => d.mood !== undefined);
  const counted = own.filter((e) => index.has(dayKey(e.writtenAt))).length;
  if (logged.length === 0 && counted === 0) return null;

  // Segments of consecutive days with a mood; a lone day is just its dot.
  const x = (i: number) => ((i + 0.5) / DAYS) * 100;
  const segments: string[] = [];
  let run: string[] = [];
  days.forEach((d, i) => {
    if (d.mood === undefined) {
      if (run.length > 1) segments.push(run.join(" "));
      run = [];
      return;
    }
    run.push(`${x(i)},${y(d.mood)}`);
  });
  if (run.length > 1) segments.push(run.join(" "));

  const label = (iso: string) => `${formatWeekday(iso)} ${formatMonth(iso)} ${formatDayNumber(iso)}`;
  const moodWord = (m: number) => MOODS[Math.round(m) as Mood].label.toLowerCase();
  const summary = `${logged.length} of the last ${DAYS} days have a mood, and ${counted} ${counted === 1 ? "entry" : "entries"}.`;

  return (
    <section aria-labelledby="mood-chart-title" className="rounded-3xl border border-line bg-card p-4.5 md:px-6 md:py-5.5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="mood-chart-title" className="text-title font-semibold">
          Your last four weeks
        </h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-me" />
            How you felt
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full border-2 border-ink-2 bg-card" />
            Entry
          </li>
          <li className="flex items-center gap-1.5">
            <Star aria-hidden className="size-3 fill-butter text-ink-2" />A first
          </li>
          <li className="flex items-center gap-1.5">
            <HeartHandshake aria-hidden className="size-3 text-them" />
            Shared
          </li>
        </ul>
      </header>
      <p className="sr-only">{summary}</p>

      <div className="mt-4 grid grid-cols-[1.5rem_1fr] gap-x-2.5">
        {/* The faces are the y axis: no numbers for a feeling. */}
        <div aria-hidden className="relative h-36 md:h-40">
          {LEVELS.map((m) => (
            <span key={m} className="absolute left-0 -translate-y-1/2" style={{ top: `${y(m)}%` }}>
              <MoodFace mood={m} className="size-5" />
            </span>
          ))}
        </div>
        <div className="relative h-36 md:h-40">
          {LEVELS.map((m) => (
            <span key={m} aria-hidden className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${y(m)}%` }} />
          ))}
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {segments.map((pts) => (
              <polyline
                key={pts}
                points={pts}
                fill="none"
                stroke="var(--color-me)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {days.map((d, i) =>
            d.mood === undefined ? null : (
              <span
                key={d.key}
                title={`${label(d.iso)}: ${moodWord(d.mood)}`}
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-me ring-3 ring-card"
                style={{ left: `${x(i)}%`, top: `${y(d.mood)}%` }}
              />
            ),
          )}
        </div>

        {/* The entries lane, one column per day. */}
        <span aria-hidden />
        <ol className="mt-3 grid min-h-8 items-start border-t border-line pt-2" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
          {days.map((d) => (
            <li key={d.key} className="flex flex-col items-center gap-1">
              {d.entries.slice(0, 3).map((e) => (
                <EntryMarker key={e.id} entry={e} label={label(e.writtenAt)} onJump={onJump} />
              ))}
            </li>
          ))}
        </ol>

        <span aria-hidden />
        <div aria-hidden className="relative mt-1 h-4 font-mono text-caption text-muted-foreground">
          {days.map((d, i) =>
            i % 7 === 0 || i === DAYS - 1 ? (
              <span key={d.key} className={cn("absolute -translate-x-1/2 whitespace-nowrap", i === DAYS - 1 && "font-semibold text-ink-2")} style={{ left: `${x(i)}%` }}>
                {i === DAYS - 1 ? "Today" : `${formatMonth(d.iso)} ${formatDayNumber(d.iso)}`}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </section>
  );
}

function EntryMarker({ entry, label, onJump }: { entry: DiaryEntry; label: string; onJump: (id: string) => void }) {
  const shared = entry.visibility === "partner" || entry.visibility === "family";
  const words = entry.body.length > 60 ? `${entry.body.slice(0, 57)}...` : entry.body;
  return (
    <a
      href={`#entry-${entry.id}`}
      onClick={() => onJump(entry.id)}
      title={`${label}: ${words}`}
      aria-label={`${entry.first ? "A first, " : ""}${shared ? "shared, " : ""}entry from ${label}: ${words}`}
      className="press flex size-6 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {entry.first ? (
        <Star aria-hidden className={cn("size-3.5 fill-butter", shared ? "text-them" : "text-ink-2")} />
      ) : (
        <span aria-hidden className={cn("size-2.5 rounded-full border-2 bg-card", shared ? "border-them bg-them-soft" : "border-ink-2")} />
      )}
    </a>
  );
}
