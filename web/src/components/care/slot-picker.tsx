"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PsychologistSlots, Slot } from "@/lib/api/types";
import { dayKey, formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { careIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Pick a day and a time, then confirm. Slots come from the API (a synthetic
// provider); nothing here is hardcoded.
export function SlotPicker({ memberId, slots, topicCount }: { memberId: string; slots: PsychologistSlots; topicCount: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Slot>();
  const [pending, startTransition] = useTransition();
  const { provider } = slots;
  const Provider = careIcon.provider;

  const days = new Map<string, Slot[]>();
  for (const s of slots.items) days.set(dayKey(s.startsAt), [...(days.get(dayKey(s.startsAt)) ?? []), s]);

  function book() {
    if (!picked) return;
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

  return (
    <section aria-labelledby="book-title" className="rounded-2xl border border-border bg-card p-6">
      <p className="text-caption font-semibold tracking-[0.07em] text-primary uppercase">Your next step</p>
      <div className="mt-3 flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Provider className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="book-title" className="text-title">
            Book a session with {provider.name}
          </h2>
          <p className="text-label text-muted-foreground">
            {provider.credentials} · {provider.focus}
          </p>
        </div>
      </div>

      {days.size === 0 ? (
        <p className="mt-5 rounded-xl bg-muted px-4 py-3 text-label text-muted-foreground">
          No open times in the next two weeks. Check back in a few days.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {[...days.entries()].map(([key, daySlots]) => (
            <li key={key} className="flex items-start gap-4">
              <div aria-hidden className="w-12 shrink-0 text-center">
                <p className="font-mono text-caption text-muted-foreground uppercase">{formatMonth(daySlots[0].startsAt)}</p>
                <p className="text-title tabular-nums">{formatDayNumber(daySlots[0].startsAt)}</p>
                <p className="text-caption text-muted-foreground">{formatWeekday(daySlots[0].startsAt)}</p>
              </div>
              <div role="group" aria-label={`${formatWeekday(daySlots[0].startsAt)} ${formatMonth(daySlots[0].startsAt)} ${formatDayNumber(daySlots[0].startsAt)}`} className="flex flex-1 flex-wrap gap-2">
                {daySlots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={picked?.id === s.id}
                    onClick={() => setPicked(s)}
                    className={cn(
                      "h-11 min-w-24 rounded-lg border px-3 font-mono text-label outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                      picked?.id === s.id
                        ? "border-primary bg-secondary text-secondary-foreground"
                        : "border-border bg-background hover:border-input hover:bg-muted",
                    )}
                  >
                    {formatClock(s.startsAt)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" disabled={!picked || pending} onClick={book} className="h-11 sm:px-6">
          {pending ? "Booking..." : picked ? `Book ${formatWeekday(picked.startsAt)} ${formatMonth(picked.startsAt)} ${formatDayNumber(picked.startsAt)}, ${formatClock(picked.startsAt)}` : "Pick a time"}
        </Button>
        <p className="text-caption text-muted-foreground">
          {topicCount} {topicCount === 1 ? "topic goes" : "topics go"} with you · times in ET
        </p>
      </div>
      <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-caption text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Only you can see your bookings. Demo provider, no real appointment.
      </p>
    </section>
  );
}
