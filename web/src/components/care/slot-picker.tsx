"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PsychologistSlots, Slot } from "@/lib/api/types";
import { dayKey, formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { careIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SessionCountdown } from "./session-countdown";

// Pick a day and a time, then confirm. Slots come from the API (a synthetic
// provider); nothing here is hardcoded.
export function SlotPicker({ memberId, slots }: { memberId: string; slots: PsychologistSlots }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Slot>();
  const [pending, startTransition] = useTransition();
  const { provider } = slots;
  const Provider = careIcon.provider;

  const days = new Map<string, Slot[]>();
  for (const s of slots.items) days.set(dayKey(s.startsAt), [...(days.get(dayKey(s.startsAt)) ?? []), s]);

  function book(picked: Slot) {
    startTransition(async () => {
      const { error, response } = await api.POST("/members/{memberId}/psychologist-bookings", {
        params: { path: { memberId } },
        body: { slotId: picked.id },
      });
      if (error) {
        toast.error(response.status === 409 ? "That time was just taken. Please pick another." : "Could not book that time. Please try again.");
        if (response.status === 409) router.refresh();
        return;
      }
      toast.success(`Booked with ${provider.name}. Your agenda goes with you.`);
      router.refresh();
    });
  }

  const first = slots.items[0];
  const chosen = picked ?? first;

  return (
    <section aria-labelledby="book-title" className="rounded-2xl border border-primary/30 bg-secondary/60 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-secondary-foreground">
          <Provider className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="book-title" className="text-title">
            {provider.name}
          </h2>
          <p className="text-label text-muted-foreground">
            {provider.credentials} · {provider.focus}
          </p>
        </div>
      </div>

      {!chosen ? (
        <p className="mt-5 rounded-xl bg-card px-4 py-3 text-label text-muted-foreground">No open times in the next two weeks. Check back in a few days.</p>
      ) : (
        <>
          <SessionCountdown startsAt={chosen.startsAt} className="mt-5" />
          <div className="mt-5 flex items-center gap-4 rounded-xl bg-card p-4">
            <div aria-hidden className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-secondary py-1.5 text-secondary-foreground">
              <span className="font-mono text-caption font-semibold uppercase">{formatMonth(chosen.startsAt)}</span>
              <span className="text-title tabular-nums">{formatDayNumber(chosen.startsAt)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-title">{picked ? "Your pick" : "Soonest time"}</p>
              <p className="mt-0.5 font-mono text-label text-muted-foreground">
                {formatWeekday(chosen.startsAt)} {formatClock(chosen.startsAt)} ET · {chosen.durationMinutes} min
              </p>
            </div>
          </div>

          <Button size="lg" disabled={pending} onClick={() => book(chosen)} className="mt-5 h-11 w-full sm:w-auto sm:px-6">
            <CalendarCheck aria-hidden />
            {pending ? "Booking..." : `Book ${formatWeekday(chosen.startsAt)} ${formatClock(chosen.startsAt)}`}
          </Button>

          {slots.items.length > 1 && (
            <details className="group mt-4 border-t border-border pt-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-label font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                Other times
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="mt-2 flex flex-col gap-3">
                {[...days.entries()].map(([key, daySlots]) => (
                  <li key={key} className="flex items-center gap-3">
                    <p className="w-16 shrink-0 font-mono text-label text-muted-foreground">
                      {formatWeekday(daySlots[0].startsAt)} {formatDayNumber(daySlots[0].startsAt)}
                    </p>
                    <div role="group" aria-label={`${formatWeekday(daySlots[0].startsAt)} ${formatMonth(daySlots[0].startsAt)} ${formatDayNumber(daySlots[0].startsAt)}`} className="flex flex-1 flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={chosen.id === s.id}
                          onClick={() => setPicked(s)}
                          className={cn(
                            "h-11 min-w-24 rounded-lg border px-3 font-mono text-label outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                            chosen.id === s.id ? "border-primary bg-card text-secondary-foreground" : "border-border bg-card/60 hover:border-input hover:bg-card",
                          )}
                        >
                          {formatClock(s.startsAt)}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
