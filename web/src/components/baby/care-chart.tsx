"use client";

import { useMemo, useState } from "react";
import { Milk } from "lucide-react";
import type { CareLogEntry, CareLogKind } from "@/lib/api/types";
import { breastSide, clockOf, dayFraction, durationWords } from "@/lib/care";
import { dayKey, formatClock, formatWeekday, formatDayNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { careLogIcon, careLogLabel, careLogTint, diaperLabel, feedMethodLabel } from "@/lib/visuals";
import { EntryEditor } from "./entry-editor";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LANES: CareLogKind[] = ["feed", "sleep", "diaper"];

/** One line about an entry: "Left breast, 15 min", "Bottle, formula, 90 ml", "1 h 20 min". */
export function entryDetail(e: CareLogEntry, now: number): string {
  if (e.kind === "feed") {
    const parts = [feedMethodLabel[e.feedMethod ?? "bottle_formula"]];
    if (e.amountMl) parts.push(`${e.amountMl} ml`);
    if (e.endedAt) parts.push(durationWords(Date.parse(e.endedAt) - Date.parse(e.startedAt)));
    return parts.join(", ");
  }
  if (e.kind === "diaper") return diaperLabel[e.diaper ?? "wet"];
  return e.endedAt ? durationWords(Date.parse(e.endedAt) - Date.parse(e.startedAt)) : `asleep for ${durationWords(now - Date.parse(e.startedAt))}`;
}

const sleepEnd = (e: CareLogEntry, now: number) => (e.endedAt ? Date.parse(e.endedAt) : now);

function hourLabel(t: number): string {
  const { h } = clockOf(t);
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

type Props = { entries: CareLogEntry[]; now: string; memberId: string; names: Record<string, string> };

/**
 * The baby's day as the centre of the Baby screen. "Last 24 hours" draws one
 * row per kind on a time axis that ends now: sleeps as bars with their length,
 * feeds and diapers as marks. "Past week" stacks the last seven days so a
 * rhythm shows. Every mark is a button: it opens the entry to correct or
 * delete it, in place under the chart.
 */
export function CareChart({ entries, now: nowIso, memberId, names }: Props) {
  const now = Date.parse(nowIso);
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = entries.find((e) => e.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="day-title" className="text-headline">
          {view === "day" ? "The last 24 hours" : "The past week"}
        </h2>
        <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-xl bg-muted p-1">
          {(
            [
              ["day", "24 hours"],
              ["week", "7 days"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn(
                "min-h-9 rounded-lg px-3.5 text-label whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                view === v ? "bg-card font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "day" ? (
        <DayChart entries={entries} now={now} names={names} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <WeekChart entries={entries} now={now} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      {selected ? (
        <EntryEditor key={selected.id} memberId={memberId} entry={selected} author={names[selected.authorId]} onClose={() => setSelectedId(null)} />
      ) : (
        <p className="text-caption text-muted-foreground">Tap a feed, sleep or diaper to change its time or details, or to remove it.</p>
      )}
    </div>
  );
}

type ChartProps = { entries: CareLogEntry[]; now: number; selectedId: string | null; onSelect: (id: string | null) => void };

function DayChart({ entries, now, names, selectedId, onSelect }: ChartProps & { names: Record<string, string> }) {
  // The axis ends at the next full hour, so "now" sits a little in from the right edge.
  const end = Math.ceil((now + 1) / HOUR) * HOUR;
  const start = end - DAY;
  const x = (t: number) => ((Math.min(Math.max(t, start), end) - start) / DAY) * 100;
  const [hover, setHover] = useState<string | null>(null);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = start; t <= end; t += HOUR) if (clockOf(t).h % 3 === 0) out.push(t);
    return out;
  }, [start, end]);
  // Night (7 PM to 7 AM) is shaded, so the night shift reads at a glance.
  const nights = useMemo(() => {
    const out: [number, number][] = [];
    let open: number | null = clockOf(start).h >= 19 || clockOf(start).h < 7 ? start : null;
    for (let t = start + HOUR; t <= end; t += HOUR) {
      const h = clockOf(t).h;
      if (h === 19) open = t;
      if (h === 7 && open !== null) {
        out.push([open, t]);
        open = null;
      }
    }
    if (open !== null) out.push([open, end]);
    return out;
  }, [start, end]);

  const inView = entries.filter((e) => (e.kind === "sleep" ? sleepEnd(e, now) : Date.parse(e.startedAt)) >= start);
  const byKind = (k: CareLogKind) => inView.filter((e) => e.kind === k);
  const sleptMs = byKind("sleep").reduce((sum, e) => sum + Math.max(0, Math.min(sleepEnd(e, now), end) - Math.max(Date.parse(e.startedAt), start)), 0);
  const totals: Record<CareLogKind, string> = {
    feed: `${byKind("feed").length} ${byKind("feed").length === 1 ? "feed" : "feeds"}`,
    sleep: `${durationWords(sleptMs)} asleep`,
    diaper: `${byKind("diaper").length} ${byKind("diaper").length === 1 ? "diaper" : "diapers"}`,
  };
  const hovered = inView.find((e) => e.id === hover);

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-y-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-x-4">
        {/* Hour labels over the plot */}
        <div aria-hidden className="hidden sm:block" />
        <div aria-hidden className="relative h-5 font-mono text-caption text-muted-foreground">
          {ticks.map((t, i) => {
            const midnight = clockOf(t).h === 0;
            return (
              <span
                key={t}
                className={cn(
                  "absolute whitespace-nowrap",
                  i === 0 ? "" : t === end ? "-translate-x-full" : "-translate-x-1/2",
                  clockOf(t).h % 6 !== 0 && "max-md:hidden",
                  midnight && "font-semibold text-foreground",
                )}
                style={{ left: `${x(t)}%` }}
              >
                {midnight ? formatWeekday(new Date(t).toISOString()) : hourLabel(t)}
              </span>
            );
          })}
        </div>

        {LANES.map((kind) => {
          const Icon = careLogIcon[kind];
          return (
            <div key={kind} className="contents">
              <div className="flex items-center gap-2.5 sm:min-h-16">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", careLogTint[kind].soft)}>
                  <Icon aria-hidden className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-label font-semibold">{careLogLabel[kind]}</p>
                  <p className="font-mono text-caption text-muted-foreground">{totals[kind]}</p>
                </div>
              </div>
              <div className="relative h-16 rounded-xl bg-muted/50">
                {nights.map(([a, b]) => (
                  <span key={a} aria-hidden className="absolute inset-y-0 bg-muted" style={{ left: `${x(a)}%`, width: `${x(b) - x(a)}%` }} />
                ))}
                {ticks.map((t) => (
                  <span key={t} aria-hidden className={cn("absolute inset-y-0 w-px", clockOf(t).h === 0 ? "bg-line-2" : "bg-line/70")} style={{ left: `${x(t)}%` }} />
                ))}
                <span aria-hidden className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60" style={{ left: `${x(now)}%` }} />
                {byKind(kind).map((e) => (
                  <Mark key={e.id} e={e} now={now} x={x} selected={e.id === selectedId} onSelect={onSelect} onHover={setHover} />
                ))}
              </div>
            </div>
          );
        })}

        <div aria-hidden className="hidden sm:block" />
        <div className="relative h-6 text-caption">
          <span className="absolute -translate-x-1/2 rounded-full bg-foreground px-2 py-0.5 font-semibold text-card" style={{ left: `${Math.min(x(now), 96)}%` }}>
            Now
          </span>
        </div>
      </div>

      <p aria-live="polite" className="min-h-6 text-label text-ink-2">
        {hovered ? (
          <>
            <span className="font-semibold">{careLogLabel[hovered.kind]}</span> at <span className="font-mono">{formatClock(hovered.startedAt)}</span>
            {hovered.kind === "sleep" && hovered.endedAt ? (
              <>
                {" "}
                to <span className="font-mono">{formatClock(hovered.endedAt)}</span>
              </>
            ) : null}
            , {entryDetail(hovered, now)}
            {names[hovered.authorId] ? `, logged by ${names[hovered.authorId]}` : ""}
          </>
        ) : null}
      </p>
    </div>
  );
}

const sideLetters = { left: "L", right: "R", both: "L R" } as const;

function Mark({
  e,
  now,
  x,
  selected,
  onSelect,
  onHover,
}: {
  e: CareLogEntry;
  now: number;
  x: (t: number) => number;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const label = `${careLogLabel[e.kind]} at ${formatClock(e.startedAt)}, ${entryDetail(e, now)}`;
  const common = {
    type: "button" as const,
    "aria-label": label,
    "aria-pressed": selected,
    onClick: () => onSelect(selected ? null : e.id),
    onPointerEnter: () => onHover(e.id),
    onPointerLeave: () => onHover(null),
    onFocus: () => onHover(e.id),
    onBlur: () => onHover(null),
  };
  const ring = selected ? "ring-3 ring-foreground/70" : "ring-2 ring-card";
  if (e.kind === "sleep") {
    const a = x(Date.parse(e.startedAt));
    const b = x(sleepEnd(e, now));
    const w = Math.max(b - a, 0.8);
    const ms = sleepEnd(e, now) - Date.parse(e.startedAt);
    return (
      <button
        {...common}
        className={cn(
          "absolute top-1/2 z-20 flex h-9 -translate-y-1/2 items-center justify-center overflow-hidden rounded-lg px-1 text-caption font-semibold whitespace-nowrap text-primary-foreground transition-[box-shadow,filter] duration-150 outline-none hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring",
          careLogTint.sleep.solid,
          ring,
          !e.endedAt && "bg-linear-to-r from-primary to-primary/50",
        )}
        style={{ left: `${a}%`, width: `${w}%` }}
      >
        {/* The length fits from about 40 minutes at 1440 px; shorter naps say it on hover. */}
        <span className={cn("font-mono", w < 3.2 && "sr-only")}>{durationWords(ms).replace(" min", "m").replace(" h", "h")}</span>
      </button>
    );
  }
  const side = breastSide(e);
  const feed = e.kind === "feed";
  return (
    <button
      {...common}
      className={cn(
        "absolute top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring",
      )}
      style={{ left: `${x(Date.parse(e.startedAt))}%` }}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full font-mono text-[0.6875rem] font-semibold transition-transform duration-150 hover:scale-110",
          ring,
          feed ? "size-8 bg-status-up text-card" : e.diaper === "wet" ? "size-6 bg-status-due-soft text-status-due" : "size-6 bg-status-due text-card",
        )}
      >
        {feed ? side ? sideLetters[side] : <Milk aria-hidden className="size-4" /> : e.diaper === "both" ? "W D" : e.diaper === "dirty" ? "D" : "W"}
      </span>
      {feed && e.amountMl ? <span className="absolute top-full mt-0.5 font-mono text-[0.625rem] whitespace-nowrap text-muted-foreground">{e.amountMl}</span> : null}
    </button>
  );
}

function WeekChart({ entries, now, selectedId, onSelect }: ChartProps) {
  // Seven Eastern calendar days ending today, oldest first, so the rows read like a diary.
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = dayKey(new Date(now - i * DAY).toISOString());
      if (!out.includes(k)) out.push(k);
    }
    return out;
  }, [now]);
  const today = days[days.length - 1];
  const nowFrac = dayFraction(now);

  // Sleeps that cross midnight are drawn in both days.
  type Seg = { e: CareLogEntry; day: string; a: number; b: number };
  const segs: Seg[] = [];
  for (const e of entries) {
    if (e.kind !== "sleep") continue;
    const s = Date.parse(e.startedAt);
    const t = sleepEnd(e, now);
    const d1 = dayKey(e.startedAt);
    const d2 = dayKey(new Date(t).toISOString());
    if (d1 === d2) segs.push({ e, day: d1, a: dayFraction(s), b: dayFraction(t) || 1 });
    else {
      segs.push({ e, day: d1, a: dayFraction(s), b: 1 });
      segs.push({ e, day: d2, a: 0, b: dayFraction(t) });
    }
  }
  const sleepByDay = (d: string) => segs.filter((s) => s.day === d);
  const marksByDay = (d: string, k: CareLogKind) => entries.filter((e) => e.kind === k && dayKey(e.startedAt) === d);
  const totalSleep = (d: string) => sleepByDay(d).reduce((sum, s) => sum + (s.b - s.a) * DAY, 0);
  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_11rem]">
        <span />
        <div aria-hidden className="relative h-5 font-mono text-caption text-muted-foreground">
          {hours.map((h) => (
            <span
              key={h}
              className={cn("absolute", h === 0 ? "" : h === 24 ? "-translate-x-full" : "-translate-x-1/2", h % 6 !== 0 && "max-md:hidden")}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </span>
          ))}
        </div>
        <span className="hidden text-right text-caption text-muted-foreground sm:block">sleep · feeds · diapers</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {days.map((d) => {
          const iso = `${d}T12:00:00-05:00`;
          const isToday = d === today;
          const feeds = marksByDay(d, "feed");
          const diapers = marksByDay(d, "diaper");
          return (
            <li key={d} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_11rem]">
              <span className={cn("text-label", isToday ? "font-semibold" : "text-muted-foreground")}>
                {isToday ? "Today" : formatWeekday(iso)} <span className="font-mono text-caption">{formatDayNumber(iso)}</span>
              </span>
              <div className="relative h-11 rounded-lg bg-muted/60">
                {[6, 12, 18].map((h) => (
                  <span key={h} aria-hidden className="absolute inset-y-0 w-px bg-line/80" style={{ left: `${(h / 24) * 100}%` }} />
                ))}
                {isToday && <span aria-hidden className="absolute inset-y-0 right-0 rounded-r-lg bg-background/70" style={{ left: `${nowFrac * 100}%` }} />}
                {sleepByDay(d).map((s) => (
                  <button
                    key={`${s.e.id}-${s.day}`}
                    type="button"
                    aria-label={`Sleep at ${formatClock(s.e.startedAt)}, ${entryDetail(s.e, now)}`}
                    aria-pressed={selectedId === s.e.id}
                    onClick={() => onSelect(selectedId === s.e.id ? null : s.e.id)}
                    className={cn(
                      "absolute top-1/2 h-4 -translate-y-1/2 rounded-[5px] outline-none hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring",
                      careLogTint.sleep.solid,
                      selectedId === s.e.id && "ring-2 ring-foreground/70",
                    )}
                    style={{ left: `${s.a * 100}%`, width: `${Math.max(s.b - s.a, 0.004) * 100}%` }}
                  />
                ))}
                {feeds.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-label={`Feed at ${formatClock(e.startedAt)}, ${entryDetail(e, now)}`}
                    aria-pressed={selectedId === e.id}
                    onClick={() => onSelect(selectedId === e.id ? null : e.id)}
                    className={cn(
                      "absolute top-0.5 size-2.5 -translate-x-1/2 rounded-full bg-status-up outline-none focus-visible:ring-3 focus-visible:ring-ring",
                      selectedId === e.id && "ring-2 ring-foreground/70",
                    )}
                    style={{ left: `${dayFraction(e.startedAt) * 100}%` }}
                  />
                ))}
                {diapers.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-label={`Diaper at ${formatClock(e.startedAt)}, ${entryDetail(e, now)}`}
                    aria-pressed={selectedId === e.id}
                    onClick={() => onSelect(selectedId === e.id ? null : e.id)}
                    className={cn(
                      "absolute bottom-0.5 h-2 w-1.5 -translate-x-1/2 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring",
                      e.diaper === "wet" ? "bg-status-due/50" : "bg-status-due",
                      selectedId === e.id && "ring-2 ring-foreground/70",
                    )}
                    style={{ left: `${dayFraction(e.startedAt) * 100}%` }}
                  />
                ))}
              </div>
              <span className="text-right font-mono text-caption text-muted-foreground tabular-nums">
                <span className="text-foreground">{(totalSleep(d) / HOUR).toFixed(1)} h</span>
                <span className="max-sm:hidden">
                  {" "}
                  · {feeds.length} · {diapers.length}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <ul aria-label="Legend" className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={cn("h-2.5 w-5 rounded-[3px]", careLogTint.sleep.solid)} />
          Sleep
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-status-up" />
          Feed
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-1.5 rounded-sm bg-status-due/50" />
          Wet
          <span aria-hidden className="ml-1 h-2 w-1.5 rounded-sm bg-status-due" />
          Dirty
        </li>
      </ul>
    </div>
  );
}
