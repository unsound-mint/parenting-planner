import { Moon } from "lucide-react";
import type { MoodCheckin } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";

const MAX_HOURS = 10;
const DAYS = 7;

// Sleep from the parent's own last seven check-ins, oldest on the left. Bars
// are plain data: no colour judgement, no "bad night" wording.
export function SleepChart({ checkins }: { checkins: MoodCheckin[] }) {
  const recent = checkins.slice(0, DAYS).reverse();
  const avg = recent.length ? recent.reduce((s, c) => s + c.sleepHours, 0) / recent.length : undefined;
  // Empty slots keep the chart's shape before there are seven check-ins.
  const slots = [...Array(DAYS - recent.length).fill(null), ...recent] as (MoodCheckin | null)[];

  return (
    <section aria-labelledby="sleep-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-status-up-soft text-status-up">
          <Moon className="size-4.5" aria-hidden />
        </span>
        <h2 id="sleep-title" className="flex-1 text-title">
          Your sleep
        </h2>
        {avg !== undefined && (
          <span className="text-right">
            <span className="block font-mono text-title tabular-nums">{avg.toFixed(1)} h</span>
            <span className="block text-caption text-muted-foreground">average</span>
          </span>
        )}
      </div>
      <ul className="mt-4 flex h-24 items-end gap-2" aria-label="Hours slept per check-in">
        {slots.map((c, i) => (
          <li key={c?.id ?? `empty-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {c ? (
              <>
                <span
                  className="w-full max-w-7 rounded-t-md bg-status-up/70"
                  style={{ height: `${Math.max(6, (Math.min(c.sleepHours, MAX_HOURS) / MAX_HOURS) * 100)}%` }}
                  title={`${c.sleepHours} h`}
                />
                <span className="font-mono text-caption text-muted-foreground" aria-hidden>
                  {formatShortDate(c.recordedAt).split(" ")[1]}
                </span>
                <span className="sr-only">
                  {formatShortDate(c.recordedAt)}: {c.sleepHours} hours
                </span>
              </>
            ) : (
              <>
                <span aria-hidden className="w-full max-w-7 rounded-t-md border border-dashed border-border bg-muted/60" style={{ height: `${30 + ((i * 37) % 40)}%` }} />
                <span aria-hidden className="text-caption text-transparent">0</span>
              </>
            )}
          </li>
        ))}
      </ul>
      {recent.length === 0 && <p className="mt-2 text-caption text-muted-foreground">Bars fill in as you check in.</p>}
    </section>
  );
}
