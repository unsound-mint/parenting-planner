import { CalendarCheck, EyeOff, Lock } from "lucide-react";
import type { CalendarEvent } from "@/lib/api/types";
import { formatClock, formatWeekday } from "@/lib/format";
import type { Role } from "@/lib/roles";
import { compactRange, eventDay, isStoredKind, weekKeys } from "@/lib/schedule";
import { calendarKindIcon, calendarKindLabel, roleTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { EventDialog, type Guest } from "./event-dialog";

export type Owner = { name: string; role: Role };

// Seven days from `from`, one column each on wide screens and a stacked list
// on phones. Events are tinted by owner; the owner's name is written too.
export function WeekView({
  from,
  today,
  events,
  owners,
  edit,
}: {
  from: string;
  today: string;
  events: CalendarEvent[];
  owners: Record<string, Owner>;
  /** Parents only: the owner can open their own stored events to change them. */
  edit?: { memberId: string; guests: Guest[]; feedActive: boolean };
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
                items.map((e) => <EventCard key={e.id} event={e} owner={e.ownerId ? owners[e.ownerId] : undefined} edit={edit && e.ownerId === edit.memberId && isStoredKind(e.kind) ? { ...edit, today } : undefined} />)
              )}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function EventCard({ event, owner, edit }: { event: CalendarEvent; owner?: Owner; edit?: { memberId: string; guests: Guest[]; feedActive: boolean; today: string } }) {
  const Icon = calendarKindIcon[event.kind] ?? CalendarCheck;
  const time = event.allDay
    ? "All day"
    : compactRange(formatClock(event.startsAt), event.endsAt ? formatClock(event.endsAt) : undefined);
  const body = (
    <>
      <span className="flex items-start gap-1.5 text-label">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 break-words">
          <span className="sr-only">{calendarKindLabel[event.kind]}: </span>
          {event.title}
        </span>
        {event.visibility === "private" && event.kind !== "shift" && (
          <>
            <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Only you</span>
          </>
        )}
        {event.neutralTitle && (
          <>
            <EyeOff className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Other calendars show only the kind</span>
          </>
        )}
      </span>
      <span className="mt-0.5 block font-mono text-caption text-muted-foreground">{time}</span>
      {owner && <span className="block text-caption font-semibold text-foreground/80">{owner.name}</span>}
    </>
  );
  return (
    <li
      className={cn(
        "min-h-11 min-w-0 rounded-lg border-l-[3px]",
        owner ? roleTint[owner.role] : "border-l-border bg-muted",
      )}
    >
      {edit ? (
        <EventDialog
          memberId={edit.memberId}
          guests={edit.guests}
          feedActive={edit.feedActive}
          event={event}
          today={edit.today}
          triggerClassName="block min-h-11 w-full cursor-pointer rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {body}
        </EventDialog>
      ) : (
        <div className="px-2.5 py-2">{body}</div>
      )}
    </li>
  );
}
