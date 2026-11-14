import type { MoodCheckin } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";

const MAX_HOURS = 10;

// Sleep from the parent's own last seven check-ins, oldest on the left. Bars
// are plain data: no colour judgement, no "bad night" wording.
export function SleepChart({ checkins }: { checkins: MoodCheckin[] }) {
  const recent = checkins.slice(0, 7).reverse();
  const avg = recent.length ? recent.reduce((s, c) => s + c.sleepHours, 0) / recent.length : 0;

  return (
    <section aria-labelledby="sleep-title" className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-baseline justify-between">
        <h2 id="sleep-title" className="text-sm font-semibold">Your sleep</h2>
        {recent.length > 0 && (
          <span className="text-xs text-muted-foreground">
            avg <span className="font-mono">{avg.toFixed(1)} h</span>
          </span>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Your sleep shows here after your first check-in.</p>
      ) : (
        <ul className="mt-3 flex h-24 items-end gap-2" aria-label="Hours slept per check-in">
          {recent.map((c) => (
            <li key={c.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span
                className="w-full max-w-7 rounded-t-md bg-primary/70 transition-[height] duration-300"
                style={{ height: `${Math.max(4, (Math.min(c.sleepHours, MAX_HOURS) / MAX_HOURS) * 100)}%` }}
                title={`${c.sleepHours} h`}
              />
              <span className="font-mono text-[10px] text-muted-foreground">{formatShortDate(c.recordedAt).split(" ")[1]}</span>
              <span className="sr-only">
                {formatShortDate(c.recordedAt)}: {c.sleepHours} hours
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
