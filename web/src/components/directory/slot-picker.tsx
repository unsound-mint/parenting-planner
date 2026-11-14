"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { BookingVisibility, ProviderBooking, ProviderSlot } from "@/lib/api/types";
import { formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { duration, ease } from "@/components/joy/motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { byDay } from "./openings";

const longLabel = (iso: string) => `${formatWeekday(iso)} ${formatMonth(iso)} ${formatDayNumber(iso)}, ${formatClock(iso)}`;

/**
 * The provider's open times as day columns; picking one opens the confirm step
 * under it: who sees the visit, an optional note, and Book (or Move, when
 * `move` is the parent's own booking with this provider).
 */
export function SlotPicker({
  memberId,
  providerName,
  slots,
  partnerName,
  defaultVisibility,
  move,
}: {
  memberId: string;
  providerName: string;
  slots: ProviderSlot[];
  /** The other parent's display name; absent when there is none. */
  partnerName?: string;
  defaultVisibility: BookingVisibility;
  move?: ProviderBooking;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<ProviderSlot>();
  const [visibility, setVisibility] = useState<BookingVisibility>(move?.visibility ?? defaultVisibility);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const days = byDay(slots);

  function confirm(s: ProviderSlot) {
    startTransition(async () => {
      const path = { params: { path: { memberId } } };
      const res = move
        ? await api.PATCH("/members/{memberId}/provider-bookings/{bookingId}", {
            params: { path: { memberId, bookingId: move.id } },
            body: { slotId: s.id, visibility },
          })
        : await api.POST("/members/{memberId}/provider-bookings", { ...path, body: { slotId: s.id, visibility, note: note.trim() || undefined } });
      if (res.error) {
        const taken = res.response.status === 409;
        toast.error(taken ? "That time was just taken. Please pick another." : "Could not book that time. Please try again.");
        if (taken) {
          setPicked(undefined);
          router.refresh();
        }
        return;
      }
      toast.success(move ? `Moved to ${longLabel(s.startsAt)}.` : `Booked with ${providerName}, ${longLabel(s.startsAt)}. It is on your calendar.`);
      setPicked(undefined);
      setNote("");
      router.replace(`/family/${memberId}/directory/${s.providerId}`, { scroll: false });
      router.refresh();
    });
  }

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-2 p-5 text-label font-normal text-muted-foreground">
        No open times in the next two weeks. Others of the same kind in the directory may have sooner ones.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Day columns: a row that scrolls on phones, a grid that uses the width on wide screens. */}
      <ol className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 @3xl:grid @3xl:grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] @3xl:overflow-visible">
        {days.map((d) => (
          <li key={d.key} className="flex w-28 shrink-0 snap-start flex-col gap-2 @3xl:w-auto">
            <p className="flex items-baseline gap-1.5 px-1">
              <span className="text-label font-semibold">{formatWeekday(d.first)}</span>
              <span className="font-mono text-caption text-muted-foreground">
                {formatMonth(d.first)} {formatDayNumber(d.first)}
              </span>
            </p>
            {d.items.map((s) => {
              const on = picked?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={longLabel(s.startsAt)}
                  onClick={() => setPicked(on ? undefined : s)}
                  className={cn(
                    "press min-h-11 rounded-xl border-[1.5px] px-3 font-mono text-label transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? "border-me bg-me-soft font-semibold text-me" : "border-line-2 bg-card hover:bg-paper",
                  )}
                >
                  {formatClock(s.startsAt)}
                </button>
              );
            })}
          </li>
        ))}
      </ol>

      <AnimatePresence initial={false}>
        {picked && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="flex flex-col gap-4 rounded-2xl bg-muted p-4 md:p-5"
          >
            <p className="flex items-center gap-2 text-title">
              <CalendarCheck className="size-5 text-me" aria-hidden />
              {longLabel(picked.startsAt)}
              <span className="font-mono text-caption text-muted-foreground">{picked.durationMinutes} min</span>
            </p>

            {partnerName && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-label">Who sees this visit</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["private", Lock, "Only you"],
                      ["family", Users, `You and ${partnerName}`],
                    ] as const
                  ).map(([v, Icon, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={visibility === v}
                      onClick={() => setVisibility(v)}
                      className={cn(
                        "press inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        visibility === v ? "border-me bg-card font-semibold text-me" : "border-transparent bg-card/60 text-ink-2 hover:bg-card",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-caption text-muted-foreground">
                  {visibility === "private" ? `${partnerName} does not see it, not even as a taken time.` : `${partnerName} sees it on the family calendar.`}
                </p>
              </fieldset>
            )}

            {!move && (
              <label className="flex flex-col gap-2">
                <span className="text-label">
                  What you want to bring up <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="bg-card" />
              </label>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-11 px-5" disabled={pending} onClick={() => confirm(picked)}>
                {pending ? (move ? "Moving..." : "Booking...") : move ? "Move to this time" : "Book this time"}
              </Button>
              <Button size="lg" variant="ghost" className="h-11" onClick={() => setPicked(undefined)}>
                Not this one
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
