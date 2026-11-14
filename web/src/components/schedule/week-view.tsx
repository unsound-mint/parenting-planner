import { CalendarCheck } from "lucide-react";
import type { CalendarEvent } from "@/lib/api/types";
import { formatClock, formatWeekday } from "@/lib/format";
import type { Role } from "@/lib/roles";
import { compactRange, eventDay, weekKeys } from "@/lib/schedule";
import { calendarKindIcon, calendarKindLabel, roleTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";

export type Owner = { name: string; role: Role };

// Seven days from `from`, one column each on wide screens and a stacked list
// on phones. Events are tinted by owner; the owner's name is written too.
export function WeekView({
  from,
  today,
  events,
  owners,
}: {
  from: string;
  today: string;
  events: CalendarEvent[];
  owners: Record<string, Owner>;
}) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const k = eventDay(e);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days = weekKeys(from);
  return (
    <ol className="grid gap-3 xl:grid-cols-7 xl:gap-2">
      {days.map((key) => {
        const items = byDay.get(key) ?? [];
        const isToday = key === today;
        const noon = `${key}T12:00:00Z`;
        return (
          <li
            key={key}
            className={cn(
              "flex min-w-0 gap-3 rounded-2xl border bg-card p-3 xl:flex-col xl:gap-2",
              isToday ? "border-primary/50" : "border-border",
            )}
          >
            <div className="flex w-12 shrink-0 flex-col items-center xl:w-auto xl:flex-row xl:gap-2">
              <span className="text-caption font-medium text-muted-foreground uppercase">{formatWeekday(noon)}</span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-title tabular-nums",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {Number(key.slice(8))}
              </span>
              {isToday && <span className="sr-only">Today</span>}
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-2">
              {items.length === 0 ? (
                <li className="py-1.5 text-caption text-muted-foreground xl:py-0">Free</li>
              ) : (
                items.map((e) => <EventCard key={e.id} event={e} owner={e.ownerId ? owners[e.ownerId] : undefined} />)
              )}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function EventCard({ event, owner }: { event: CalendarEvent; owner?: Owner }) {
  const Icon = calendarKindIcon[event.kind] ?? CalendarCheck;
  const time = event.allDay
    ? "All day"
    : compactRange(formatClock(event.startsAt), event.endsAt ? formatClock(event.endsAt) : undefined);
  return (
    <li
      className={cn(
        "min-h-11 min-w-0 rounded-lg border-l-[3px] px-2.5 py-2",
        owner ? roleTint[owner.role] : "border-l-border bg-muted",
      )}
    >
      <p className="flex items-start gap-1.5 text-label">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 break-words">
          <span className="sr-only">{calendarKindLabel[event.kind]}: </span>
          {event.title}
        </span>
      </p>
      <p className="mt-0.5 font-mono text-caption text-muted-foreground">{time}</p>
      {owner && <p className="text-caption font-semibold text-foreground/80">{owner.name}</p>}
    </li>
  );
}
