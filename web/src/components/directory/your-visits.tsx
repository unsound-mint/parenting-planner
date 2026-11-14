"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Lock, Users, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { ProviderBooking } from "@/lib/api/types";
import { formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

/**
 * Upcoming directory visits the acting parent may see: their own, with Move,
 * Share and Cancel, and the ones their partner shared, read-only. Cancel asks
 * once in place, never with a browser dialog.
 */
export function YourVisits({
  memberId,
  bookings,
  partnerName,
  now,
  className,
  showProvider = true,
}: {
  memberId: string;
  bookings: ProviderBooking[];
  partnerName?: string;
  now: Date;
  className?: string;
  /** False on a provider's own page, where the heading already names them. */
  showProvider?: boolean;
}) {
  const upcoming = bookings.filter((b) => new Date(b.startsAt).getTime() > now.getTime());
  if (upcoming.length === 0) return null;
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      <AnimatePresence initial={false}>
        {upcoming.map((b) => (
          <Visit key={b.id} memberId={memberId} booking={b} partnerName={partnerName} showProvider={showProvider} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Visit({ memberId, booking: b, partnerName, showProvider }: { memberId: string; booking: ProviderBooking; partnerName?: string; showProvider: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const own = b.memberId === memberId;
  const path = { params: { path: { memberId, bookingId: b.id } } };

  function cancel() {
    startTransition(async () => {
      const { error } = await api.DELETE("/members/{memberId}/provider-bookings/{bookingId}", path);
      if (error) {
        toast.error("Could not cancel. Please try again.");
        return;
      }
      toast.success(`Cancelled your visit with ${b.providerName}. The time is open again.`);
      router.refresh();
    });
  }

  function share() {
    startTransition(async () => {
      const visibility = b.visibility === "private" ? "family" : "private";
      const { error } = await api.PATCH("/members/{memberId}/provider-bookings/{bookingId}", { ...path, body: { visibility } });
      if (error) {
        toast.error("Could not change who sees it. Please try again.");
        return;
      }
      router.refresh();
    });
  }

  const action = "press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-label outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <motion.li layout exit={{ opacity: 0, scale: 0.98 }} transition={spring.ui} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card p-3 pr-2">
      <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-me-soft text-me">
        <span className="text-caption font-semibold uppercase">{formatWeekday(b.startsAt)}</span>
        <span className="font-mono text-title leading-none">{formatDayNumber(b.startsAt)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium">{showProvider ? b.providerName : `${formatClock(b.startsAt)}, ${b.durationMinutes} min`}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-label font-normal text-muted-foreground">
          <span className="font-mono">
            {formatMonth(b.startsAt)} {formatDayNumber(b.startsAt)}
            {showProvider && `, ${formatClock(b.startsAt)}`}
          </span>
          <span aria-hidden>·</span>
          {own ? (
            <span className="inline-flex items-center gap-1">
              {b.visibility === "private" ? <Lock className="size-3.5" aria-hidden /> : <Users className="size-3.5" aria-hidden />}
              {b.visibility === "private" ? "Only you" : partnerName ? `You and ${partnerName}` : "Shared"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {partnerName ? `${partnerName} shared it` : "Shared with you"}
            </span>
          )}
        </p>
      </div>
      {own && (
        <div className="flex items-center gap-1">
          {asking ? (
            <>
              <button type="button" disabled={pending} onClick={cancel} className={cn(action, "font-semibold text-me")}>
                {pending ? "Cancelling..." : "Yes, cancel"}
              </button>
              <button type="button" onClick={() => setAsking(false)} className={action}>
                Keep it
              </button>
            </>
          ) : (
            <>
              <Link href={`/family/${memberId}/directory/${b.providerId}?move=${b.id}`} className={action}>
                <CalendarClock className="size-4" aria-hidden />
                Move
              </Link>
              {partnerName && (
                <button type="button" disabled={pending} onClick={share} className={action}>
                  {b.visibility === "private" ? <Users className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                  {b.visibility === "private" ? `Share with ${partnerName}` : "Make private"}
                </button>
              )}
              <button type="button" onClick={() => setAsking(true)} className={action} aria-label={`Cancel visit with ${b.providerName}`}>
                <X className="size-4" aria-hidden />
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </motion.li>
  );
}
