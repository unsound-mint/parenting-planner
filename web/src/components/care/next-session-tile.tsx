import { Clock, Lock } from "lucide-react";
import type { PsychologistBooking } from "@/lib/api/types";
import { daysUntilInstant, formatClock, formatDayNumber, formatMonth, formatWeekday, whenWords } from "@/lib/format";
import { careIcon } from "@/lib/visuals";

// The booked session as a date tile: the date is the picture, the provider and
// time are the label. Visible to the booking parent only.
export function NextSessionTile({ booking, topicCount }: { booking: PsychologistBooking; topicCount: number }) {
  const days = daysUntilInstant(booking.startsAt);
  const Provider = careIcon.provider;
  return (
    <section aria-labelledby="session-title" className="rounded-2xl border border-border bg-card p-6">
      <p className="text-caption font-semibold tracking-[0.07em] text-primary uppercase">Next session</p>
      <div className="mt-3 flex items-center gap-5">
        <div aria-hidden className="flex w-20 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-border bg-background text-center">
          <span className="w-full bg-secondary py-1 font-mono text-caption font-semibold text-secondary-foreground uppercase">
            {formatMonth(booking.startsAt)}
          </span>
          <span className="pt-2 text-headline tabular-nums">{formatDayNumber(booking.startsAt)}</span>
          <span className="pb-2 text-caption text-muted-foreground">{formatWeekday(booking.startsAt)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="session-title" className="text-title">
            {booking.provider.name}
          </h2>
          <p className="text-label text-muted-foreground">{booking.provider.credentials}</p>
          <p className="mt-2 flex items-center gap-2 font-mono text-label">
            <Clock className="size-4 text-muted-foreground" aria-hidden />
            {formatClock(booking.startsAt)} ET · {booking.durationMinutes} min
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <Provider className="ml-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-1 text-label font-semibold">{whenWords(days)}</p>
          <p className="text-caption text-muted-foreground">
            {topicCount} {topicCount === 1 ? "topic" : "topics"} ready
          </p>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-caption text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Only you can see this booking.
      </p>
    </section>
  );
}
