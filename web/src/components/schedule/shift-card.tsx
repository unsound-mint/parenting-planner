import { Baby } from "lucide-react";
import type { Role } from "@/lib/roles";
import { dayWords, shiftTimes, weekdays, type ShiftLike } from "@/lib/schedule";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// A recurring shift as a picture: seven weekday pips, filled where it runs.
// Used for the simulator's suggestion and for agreed shifts in the calendar.
export function ShiftCard({
  shift,
  owner,
  note,
  className,
}: {
  shift: ShiftLike;
  owner?: { name: string; role: Role };
  note?: string;
  className?: string;
}) {
  const on = new Set(shift.days);
  const accent = owner ? roleAccent[owner.role] : undefined;
  return (
    <div className={cn("flex items-center gap-4 rounded-xl border border-border bg-background p-4", className)}>
      <span
        aria-hidden
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground", accent?.text)}
      >
        <Baby className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-title">{shift.title}</p>
        <p className="font-mono text-label text-muted-foreground">
          {dayWords(shift.days)} · {shiftTimes(shift)}
        </p>
        {owner && <p className={cn("text-caption font-semibold", accent?.text)}>{owner.name}</p>}
        {note && <p className="text-caption text-muted-foreground">{note}</p>}
      </div>
      <ul aria-hidden className="hidden gap-1 sm:flex">
        {weekdays.map((d) => (
          <li
            key={d.id}
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-caption font-semibold",
              on.has(d.id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {d.short.charAt(0)}
          </li>
        ))}
      </ul>
    </div>
  );
}
