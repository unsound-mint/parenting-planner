import Link from "next/link";
import { Lock } from "lucide-react";
import type { MoodCheckin, MoodPattern, MoodPatternKind } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { patternIcon, talkIcon } from "@/lib/visuals";
import { buttonVariants } from "@/components/ui/button";

const DAYS = 7;
const MAX_SLEEP = 10;

const titles: Record<MoodPatternKind, (days: number) => string> = {
  low_mood: (d) => `Low mood on ${d} days`,
  low_mood_and_sleep: (d) => `Low mood and short sleep, ${d} days`,
};

// Shown above the check-in when the parent's own check-ins form a pattern. It
// names what the numbers show and points to a person; it never labels the
// parent (docs/product.md, principle 3). The pattern is private to its author.
export function MoodPatternCard({
  pattern,
  checkins,
  memberId,
}: {
  pattern: MoodPattern;
  /** The parent's own check-ins, newest first. */
  checkins: MoodCheckin[];
  memberId: string;
}) {
  const flagged = new Set(pattern.checkinIds);
  const week = checkins.slice(0, DAYS).reverse();
  const Icon = patternIcon;
  const Talk = talkIcon;

  return (
    <section aria-labelledby="pattern-title" className="rounded-2xl border border-status-due/30 bg-status-due-soft/40 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-due-soft text-status-due">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <h2 id="pattern-title" className="text-title">
          {titles[pattern.kind](pattern.days)}
        </h2>
      </div>

      <Spark week={week} flagged={flagged} />

      <p className="mt-4 text-body">{pattern.message}</p>
      <p className="mt-2 font-mono text-caption text-muted-foreground">
        since {formatShortDate(pattern.startedOn)} · {pattern.source.title}
      </p>

      <Link
        href={`/family/${memberId}/directory?type=${pattern.providerType}`}
        className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}
      >
        <Talk aria-hidden />
        Talk to someone
      </Link>
      <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Only you can see this
      </p>
    </section>
  );
}

// Seven check-ins, oldest on the left: mood as a line above, sleep as bars
// below. The days in the pattern sit on a soft band.
function Spark({ week, flagged }: { week: MoodCheckin[]; flagged: Set<string> }) {
  const W = 280;
  const slot = W / DAYS;
  const x = (i: number) => (DAYS - week.length + i + 0.5) * slot;
  const moodY = (m: number) => 8 + (5 - m) * 11; // 5 at the top, 1 at the bottom
  const barH = (h: number) => Math.max(3, (Math.min(h, MAX_SLEEP) / MAX_SLEEP) * 32);
  const line = week.map((c, i) => `${i ? "L" : "M"}${x(i)},${moodY(c.mood)}`).join(" ");

  return (
    <figure className="mt-4">
      <svg viewBox="0 0 280 112" className="h-auto w-full" role="img" aria-label="Mood and sleep over your last check-ins">
        {week.map((c, i) =>
          flagged.has(c.id) ? (
            <rect key={c.id} x={x(i) - slot / 2 + 2} y={0} width={slot - 4} height={112} rx={8} className="fill-status-due/15" />
          ) : null,
        )}
        <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-muted-foreground/50" />
        {week.map((c, i) => (
          <circle key={c.id} cx={x(i)} cy={moodY(c.mood)} r={flagged.has(c.id) ? 5 : 3.5} className={flagged.has(c.id) ? "fill-status-due" : "fill-muted-foreground/60"} />
        ))}
        {week.map((c, i) => (
          <rect
            key={c.id}
            x={x(i) - 8}
            y={92 - barH(c.sleepHours)}
            width={16}
            height={barH(c.sleepHours)}
            rx={3}
            className={flagged.has(c.id) ? "fill-status-due/70" : "fill-status-up/50"}
          />
        ))}
        {week.map((c, i) => (
          <text key={c.id} x={x(i)} y={108} textAnchor="middle" className="fill-muted-foreground font-mono text-caption" aria-hidden>
            {formatShortDate(c.recordedAt).split(" ")[1]}
          </text>
        ))}
      </svg>
      <figcaption className="sr-only">
        {week.map((c) => `${formatShortDate(c.recordedAt)}: mood ${c.mood} of 5, ${c.sleepHours} hours of sleep`).join(". ")}
      </figcaption>
    </figure>
  );
}
