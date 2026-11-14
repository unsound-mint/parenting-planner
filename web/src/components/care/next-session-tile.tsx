"use client";

import { CalendarPlus, Clock, ListChecks, Lock } from "lucide-react";
import type { PsychologistBooking } from "@/lib/api/types";
import { formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SessionCountdown } from "./session-countdown";

// A calendar file the parent can open anywhere. No server route involved.
function icsHref(b: PsychologistBooking): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(b.startsAt);
  const end = new Date(start.getTime() + b.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parenting Planner//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@parenting-planner`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:Session with ${b.provider.name}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

// The booked session: the countdown is the picture, the slot and one action
// sit beside it. Visible to the booking parent only.
export function NextSessionTile({ booking, topicCount }: { booking: PsychologistBooking; topicCount: number }) {
  return (
    <section aria-labelledby="session-title" className="rounded-2xl border border-primary/30 bg-secondary/60 p-5 sm:p-6">
      <h2 id="session-title" className="sr-only">
        Next session with {booking.provider.name}
      </h2>
      <SessionCountdown startsAt={booking.startsAt} />
      <div className="mt-5 flex items-center gap-4 rounded-xl bg-card p-4">
        <div aria-hidden className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-secondary py-1.5 text-secondary-foreground">
          <span className="font-mono text-caption font-semibold uppercase">{formatMonth(booking.startsAt)}</span>
          <span className="text-title tabular-nums">{formatDayNumber(booking.startsAt)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-title">{booking.provider.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-label text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {formatWeekday(booking.startsAt)} {formatClock(booking.startsAt)} ET
            </span>
            <span>{booking.durationMinutes} min</span>
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" nativeButton={false} render={<a href={icsHref(booking)} download="session.ics" />} className="h-11 sm:px-6">
          <CalendarPlus aria-hidden />
          Add to calendar
        </Button>
        <p className="flex items-center gap-2 text-label text-muted-foreground">
          <ListChecks className="size-4" aria-hidden />
          {topicCount} {topicCount === 1 ? "topic" : "topics"} ready
        </p>
      </div>
      <p className="mt-4 flex items-center gap-2 text-caption text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Only you can see this booking.
      </p>
    </section>
  );
}
