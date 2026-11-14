import { CalendarClock, ListChecks, type LucideIcon } from "lucide-react";
import type { CalendarEvent, PlanItemStatus, Task } from "@/lib/api/types";
import { daysUntil, daysUntilInstant, formatClock, formatShortDate, whenWords } from "@/lib/format";
import { statusTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";

type Row = { key: string; icon: LucideIcon; title: string; when: string; sort: number; status: PlanItemStatus };

// The next two days of events and the next week of tasks, in time order. It
// complements the plan above (guidelines) with what is already booked or
// assigned. Renders nothing when there is nothing to show.
export function ComingUp({ events, tasks }: { events: CalendarEvent[]; tasks: Task[] }) {
  const rows: Row[] = [
    ...events.map((e): Row => {
      const days = daysUntilInstant(e.startsAt);
      const time = e.allDay ? "" : ` · ${formatClock(e.startsAt)}`;
      return { key: `e-${e.id}`, icon: CalendarClock, title: e.title, when: `${whenWords(days)}${time}`, sort: Date.parse(e.startsAt), status: "upcoming" };
    }),
    ...tasks
      .filter((t) => !t.done)
      .map((t): Row => {
        const days = t.dueOn ? daysUntil(t.dueOn) : undefined;
        const status: PlanItemStatus = days === undefined ? "upcoming" : days < 0 ? "overdue" : days <= 2 ? "due" : "upcoming";
        const when = t.dueOn ? `${days! < 0 ? "overdue · " : ""}by ${formatShortDate(t.dueOn)}` : "No set date";
        return { key: `t-${t.id}`, icon: ListChecks, title: t.title, when, sort: t.dueOn ? Date.parse(t.dueOn) : Infinity, status };
      }),
  ].sort((a, b) => a.sort - b.sort);

  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="coming-title" className="mt-2">
      <h2 id="coming-title" className="text-title">
        Coming up
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", statusTint[r.status])}>
              <r.icon className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold">{r.title}</span>
              <span className="block font-mono text-caption text-muted-foreground">{r.when}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
