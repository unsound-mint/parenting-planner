import Link from "next/link";
import { Lock, Moon } from "lucide-react";
import type { MoodCheckin, MoodPattern, MoodPatternKind } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { patternIcon, talkIcon } from "@/lib/visuals";
import { buttonVariants } from "@/components/ui/button";
import { MoodCheckinCard } from "./mood-checkin-card";

const DAYS = 7;
const MAX_SLEEP = 10;
// Own check-ins needed before the week chart earns its space.
const MIN_CHECKINS = 3;

const patternTitle: Record<MoodPatternKind, (days: number) => string> = {
  low_mood: (d) => `Low mood on ${d} days`,
  low_mood_and_sleep: (d) => `Low mood and short sleep on ${d} days`,
};

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

// One card for how the parent is doing: today's check-in first (the action),
// then the last seven days it builds (mood as dots, sleep as bars). A pattern
// from the check-ins marks its days on the same chart instead of a card of its
// own. When the plan already has a mental health step, that step carries the
// "Talk to someone" action and the guideline (talkInPlan), so this card only
// shows the evidence. Check-ins and patterns are private to their author.
export function MoodSleepCard({
  memberId,
  partnerName,
  checkins,
  pattern,
  talkInPlan,
}: {
  memberId: string;
  partnerName?: string;
  /** The parent's own check-ins, newest first. */
  checkins: MoodCheckin[];
  pattern?: MoodPattern;
  talkInPlan: boolean;
}) {
  const showWeek = checkins.length >= MIN_CHECKINS || !!pattern;
  return (
    <section aria-label="Mood and sleep" className="rounded-2xl border border-border bg-card p-5">
      <MoodCheckinCard memberId={memberId} partnerName={partnerName} bare />
      {showWeek && (
        <div className="mt-5 border-t border-border pt-5">
          {pattern && <PatternLine pattern={pattern} />}
          <WeekChart checkins={checkins} flagged={new Set(pattern?.checkinIds ?? [])} />
          {pattern && !talkInPlan && (
            <>
              <p className="mt-4 text-body">{pattern.message}</p>
              <p className="mt-2 font-mono text-caption text-muted-foreground">
                {pattern.source.title}, checked {formatLongDate(pattern.source.checkedAt)}
              </p>
              <Link href={`/family/${memberId}/directory?type=${pattern.providerType}`} className={cn(buttonVariants({ size: "lg" }), "mt-4 h-11 w-full text-label")}>
                <TalkIcon />
                Talk to someone
              </Link>
            </>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Only you can see your check-ins
          </p>
        </div>
      )}
    </section>
  );
}

function TalkIcon() {
  const Icon = talkIcon;
  return <Icon aria-hidden />;
}

function PatternLine({ pattern }: { pattern: MoodPattern }) {
  const Icon = patternIcon;
  return (
    <p className="mb-3 flex items-center gap-2 text-label font-semibold text-status-due">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-status-due-soft">
        <Icon className="size-3.5" aria-hidden />
      </span>
      {patternTitle[pattern.kind](pattern.days)}
    </p>
  );
}

type Day = { key: string; checkin?: MoodCheckin };

// The last seven calendar days ending today, so a missed day shows as a gap.
// Days are UTC dates, like every date the API sends (lib/format.ts).
function lastDays(checkins: MoodCheckin[]): Day[] {
  const byDay = new Map<string, MoodCheckin>();
  // Newest first, so the first check-in of a day is its latest.
  for (const c of checkins) if (!byDay.has(c.recordedAt.slice(0, 10))) byDay.set(c.recordedAt.slice(0, 10), c);
  const today = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAYS - 1 - i)));
    const key = d.toISOString().slice(0, 10);
    return { key, checkin: byDay.get(key) };
  });
}

// Mood as dots joined by a line (5 at the top), sleep as bars below. Pattern
// days sit on a soft band. Bars are plain data outside a pattern: no colour
// judgement on a single short night.
function WeekChart({ checkins, flagged }: { checkins: MoodCheckin[]; flagged: Set<string> }) {
  const days = lastDays(checkins);
  const logged = days.filter((d) => d.checkin).map((d) => d.checkin!);
  const avg = logged.length ? logged.reduce((s, c) => s + c.sleepHours, 0) / logged.length : undefined;
  const W = 280;
  const slot = W / DAYS;
  const x = (i: number) => (i + 0.5) * slot;
  const moodY = (m: number) => 8 + (5 - m) * 9; // 8..44
  const barH = (h: number) => Math.max(3, (Math.min(h, MAX_SLEEP) / MAX_SLEEP) * 40);
  const points = days.map((d, i) => (d.checkin ? { i, c: d.checkin } : null)).filter((p) => p !== null);
  const line = points.map((p, n) => `${n ? "L" : "M"}${x(p.i)},${moodY(p.c.mood)}`).join(" ");

  return (
    <figure>
      <div className="flex items-center gap-4 text-caption text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-foreground/60" />
          Mood
        </span>
        <span className="flex items-center gap-1.5">
          <Moon className="size-3.5" aria-hidden />
          Sleep
        </span>
        {avg !== undefined && <span className="ml-auto font-mono text-foreground tabular-nums">{avg.toFixed(1)} h avg</span>}
      </div>
      <svg viewBox={`0 0 ${W} 100`} className="mt-2 h-auto w-full" role="img" aria-label="Mood and sleep over the last seven days">
        {days.map((d, i) =>
          d.checkin && flagged.has(d.checkin.id) ? (
            <rect key={d.key} x={x(i) - slot / 2 + 2} y={0} width={slot - 4} height={100} rx={8} className="fill-status-due/15" />
          ) : null,
        )}
        <line x1={0} x2={W} y1={98} y2={98} strokeWidth={1} className="stroke-border" />
        {points.length > 1 && <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-muted-foreground/40" />}
        {points.map(({ i, c }) => (
          <circle key={c.id} cx={x(i)} cy={moodY(c.mood)} r={flagged.has(c.id) ? 5 : 4} className={flagged.has(c.id) ? "fill-status-due" : "fill-foreground/60"} />
        ))}
        {points.map(({ i, c }) => (
          <rect
            key={c.id}
            x={x(i) - 9}
            y={98 - barH(c.sleepHours)}
            width={18}
            height={barH(c.sleepHours)}
            rx={3}
            className={flagged.has(c.id) ? "fill-status-due/70" : "fill-status-up/60"}
          />
        ))}
      </svg>
      <div className="mt-1 grid grid-cols-7 text-center" aria-hidden>
        {days.map((d, i) => (
          <span key={d.key} className={cn("flex flex-col text-caption", i === DAYS - 1 ? "font-semibold text-foreground" : "text-muted-foreground")}>
            <span>{i === DAYS - 1 ? "Today" : weekday.format(new Date(d.key))}</span>
            <span className="font-mono">{Number(d.key.slice(8))}</span>
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {days
          .filter((d) => d.checkin)
          .map((d) => `${weekday.format(new Date(d.key))} ${Number(d.key.slice(8))}: mood ${d.checkin!.mood} of 5, ${d.checkin!.sleepHours} hours of sleep`)
          .join(". ")}
      </figcaption>
    </figure>
  );
}
