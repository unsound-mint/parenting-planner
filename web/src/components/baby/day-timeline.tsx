import type { CareLogEntry, CareLogKind } from "@/lib/api/types";
import { formatClock } from "@/lib/format";
import { dayFraction, isToday } from "@/lib/care";
import { cn } from "@/lib/utils";
import { careLogIcon, careLogLabel, careLogTint, diaperLabel, feedMethodLabel } from "@/lib/visuals";

const LANES: CareLogKind[] = ["feed", "sleep", "diaper"];
const HOURS = [0, 6, 12, 18, 24];

function detail(e: CareLogEntry): string {
  if (e.kind === "feed") return `${feedMethodLabel[e.feedMethod ?? "bottle_formula"]}${e.amountMl ? `, ${e.amountMl} ml` : ""}`;
  if (e.kind === "diaper") return diaperLabel[e.diaper ?? "wet"];
  return e.endedAt ? `until ${formatClock(e.endedAt)}` : "still asleep";
}

// Today as three lanes on a 24 hour line: feeds and diapers are dots, sleeps are
// bars, a thin line marks now. Drawn from the entries; the list for screen readers repeats them.
export function DayTimeline({ entries, now }: { entries: CareLogEntry[]; now: Date }) {
  const today = entries.filter((e) => isToday(e.startedAt, now) || (e.endedAt && isToday(e.endedAt, now)));
  const nowPct = dayFraction(now.getTime()) * 100;

  return (
    <div>
      <div className="relative">
        {/* Hour grid behind the lanes */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-9">
          {HOURS.map((h) => (
            <span key={h} className="absolute inset-y-0 w-px bg-border" style={{ left: `${(h / 24) * 100}%` }} />
          ))}
          <span className="absolute inset-y-0 z-10 w-0.5 rounded-full bg-foreground/50" style={{ left: `${nowPct}%` }} />
        </div>

        <div className="flex flex-col gap-1">
          {LANES.map((kind) => {
            const Icon = careLogIcon[kind];
            return (
              <div key={kind} className="flex h-9 items-center gap-3">
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", careLogTint[kind].soft)}>
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <div className="relative h-full flex-1">
                  {today
                    .filter((e) => e.kind === kind)
                    .map((e) => {
                      const start = isToday(e.startedAt, now) ? dayFraction(e.startedAt) : 0;
                      if (kind !== "sleep") {
                        return (
                          <span
                            key={e.id}
                            title={`${careLogLabel[kind]} ${formatClock(e.startedAt)}, ${detail(e)}`}
                            className={cn("absolute top-1/2 z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", careLogTint[kind].solid)}
                            style={{ left: `${start * 100}%` }}
                          />
                        );
                      }
                      const end = e.endedAt && isToday(e.endedAt, now) ? dayFraction(e.endedAt) : e.endedAt ? 1 : nowPct / 100;
                      return (
                        <span
                          key={e.id}
                          title={`Sleep ${formatClock(e.startedAt)}, ${detail(e)}`}
                          className={cn("absolute top-1/2 z-20 h-4 -translate-y-1/2 rounded-full ring-2 ring-card", careLogTint.sleep.solid)}
                          style={{ left: `${start * 100}%`, width: `${Math.max(end - start, 0.012) * 100}%` }}
                        />
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div aria-hidden className="relative mt-1 ml-9 h-4 font-mono text-caption text-muted-foreground">
        {HOURS.map((h) => (
          <span
            key={h}
            className={cn("absolute", h === 0 ? "" : h === 24 ? "-translate-x-full" : "-translate-x-1/2")}
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {h === 0 || h === 24 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
          </span>
        ))}
      </div>

      <ul className="sr-only">
        {today.length === 0 && <li>Nothing logged today.</li>}
        {[...today].reverse().map((e) => (
          <li key={e.id}>
            {careLogLabel[e.kind]} at {formatClock(e.startedAt)}, {detail(e)}
          </li>
        ))}
      </ul>
    </div>
  );
}
