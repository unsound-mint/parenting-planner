import { daysUntilInstant } from "@/lib/format";
import { cn } from "@/lib/utils";

const WINDOW = 14;

// The days left, drawn: one dot per day for the next two weeks, today on the
// left, the session day as the filled ring. Text repeats it for screen readers.
export function SessionCountdown({ startsAt, className }: { startsAt: string; className?: string }) {
  const days = Math.max(0, daysUntilInstant(startsAt));
  const at = Math.min(days, WINDOW);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="flex items-baseline gap-2">
        <span className="text-display tabular-nums">{days === 0 ? "Today" : days}</span>
        {days > 0 && <span className="text-title text-muted-foreground">{days === 1 ? "day to go" : "days to go"}</span>}
      </p>
      <div aria-hidden className="flex items-center gap-1">
        {Array.from({ length: WINDOW + 1 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i === at ? "size-4 flex-none bg-primary ring-4 ring-primary/25" : i < at ? "bg-primary/60" : "bg-foreground/10",
            )}
          />
        ))}
      </div>
      <div aria-hidden className="flex justify-between font-mono text-caption text-muted-foreground">
        <span>Today</span>
        <span>14 days</span>
      </div>
    </div>
  );
}
