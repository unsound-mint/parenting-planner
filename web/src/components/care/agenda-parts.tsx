"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, Reorder, animate, motion, useDragControls, useReducedMotion } from "motion/react";
import { CalendarCheck, GripVertical, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { AgendaTopic, PsychologistBooking, Slot } from "@/lib/api/types";
import { dayKey, formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { duration, ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cleanName } from "./names";

/** The key a topic keeps from its optimistic copy to the server's: the entry it came from, else its id. */
export const topicKey = (t: AgendaTopic) => t.diaryEntryId ?? t.id;

export const initials = (name: string) =>
  cleanName(name)
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Where a new topic should come from: take() hands over the rect of the field it was typed in, once; fresh() marks one that should drop in. */
export type Flights = { take: (key: string) => DOMRect | undefined; fresh: (key: string) => boolean };

export function TopicRow({
  topic,
  index,
  origin,
  busy,
  flights,
  onRemove,
  onDrop,
  extra,
}: {
  topic: AgendaTopic;
  index: number;
  origin: { label: string; href?: string };
  /** Under the origin line: the "send what I wrote" choice. */
  extra?: React.ReactNode;
  busy: boolean;
  flights: Flights;
  onRemove: () => void;
  onDrop: () => void;
}) {
  const controls = useDragControls();
  const inner = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // A topic brought from an entry flies from its title field into place
  // (spring.gentle, transform and opacity only); one from the suggestion drops
  // in. When the card is out of view (phones) the flight is skipped and the row
  // just lands. Reduced motion: a fade.
  // The flight is read once and kept in a ref: in dev, Strict Mode runs this
  // effect twice and the first cleanup stops the animation, so the second run
  // must be able to start it again.
  const landing = useRef<{ from?: DOMRect; fresh: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const key = topicKey(topic);
    landing.current ??= { from: flights.take(key), fresh: flights.fresh(key) };
    const { from, fresh } = landing.current;
    if (!from && !fresh) return;
    if (reduce) {
      const c = animate(el, { opacity: [0, 1] }, { duration: duration.base });
      return () => c.stop();
    }
    const to = el.getBoundingClientRect();
    if (from && to.top < window.innerHeight && to.bottom > 0) {
      el.style.zIndex = "20";
      const c = animate(el, { x: [from.left - to.left, 0], y: [from.top - to.top, 0], scale: [0.96, 1], opacity: [0.6, 1] }, spring.gentle);
      c.then(() => (el.style.zIndex = ""));
      return () => {
        c.stop();
        el.style.zIndex = "";
      };
    }
    const c = animate(el, { y: [-16, 0], scale: [0.97, 1], opacity: [0, 1] }, { duration: duration.enter, ease: ease.out });
    return () => c.stop();
    // Only when the row mounts: later renders never replay the landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Reorder.Item value={topic} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="relative list-none select-none" whileDrag={{ scale: 1.02 }}>
      <div ref={inner} className="group relative grid grid-cols-[1.75rem_1fr_auto] items-start gap-3 rounded-2xl bg-muted py-3 pr-2 pl-3.5">
        <button
          type="button"
          aria-label={`Topic ${index + 1}, drag to move`}
          disabled={busy}
          onPointerDown={(e) => !busy && controls.start(e)}
          className="mt-0.5 flex size-7 cursor-grab touch-none items-center justify-center rounded-full bg-card font-heading text-label font-semibold text-ink-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <span className="pointer-fine:group-hover:hidden">{index + 1}</span>
          <GripVertical className="hidden size-3.5 pointer-fine:group-hover:block" aria-hidden />
        </button>
        <div className="min-w-0 py-0.5">
          <p className="text-body font-semibold text-ink">{topic.text}</p>
          {origin.href ? (
            <a href={origin.href} className="text-caption text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink">
              {origin.label}
            </a>
          ) : (
            <p className="text-caption text-muted-foreground">{origin.label}</p>
          )}
          {extra && <div>{extra}</div>}
        </div>
        <button
          type="button"
          aria-label={`Remove "${topic.text}"`}
          disabled={busy}
          onClick={onRemove}
          className="press flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-card hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </Reorder.Item>
  );
}

const slotLabel = (s: Slot) => `${formatWeekday(s.startsAt)} ${formatMonth(s.startsAt)} ${formatDayNumber(s.startsAt)}, ${formatClock(s.startsAt)}`;

/** The three soonest times as chips, the rest a tap away; picking one shows the Book button. */
export function PickATime({
  memberId,
  slots,
  short,
  moving,
  title = "Pick a time",
  onDone,
}: {
  memberId: string;
  slots: Slot[];
  short: string;
  /** Set to move this booking instead of booking a new one. */
  moving?: PsychologistBooking;
  title?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Slot>();
  const [more, setMore] = useState(false);
  const [pending, startTransition] = useTransition();
  const first = slots.slice(0, 3);
  const rest = new Map<string, Slot[]>();
  for (const s of slots.slice(3)) rest.set(dayKey(s.startsAt), [...(rest.get(dayKey(s.startsAt)) ?? []), s]);

  function book(s: Slot) {
    startTransition(async () => {
      const { error, response } = moving
        ? await api.PATCH("/members/{memberId}/psychologist-bookings/{bookingId}", { params: { path: { memberId, bookingId: moving.id } }, body: { slotId: s.id } })
        : await api.POST("/members/{memberId}/psychologist-bookings", { params: { path: { memberId } }, body: { slotId: s.id } });
      if (error) {
        toast.error(response.status === 409 ? "That time was just taken. Please pick another." : "Could not save that time. Please try again.");
        if (response.status === 409) router.refresh();
        return;
      }
      toast.success(moving ? `Moved to ${formatWeekday(s.startsAt)} ${formatClock(s.startsAt)}.` : `Booked with ${short}.`);
      onDone?.();
      router.refresh();
    });
  }

  const chip = (s: Slot, label: string) => (
    <button
      key={s.id}
      type="button"
      aria-pressed={picked?.id === s.id}
      onClick={() => setPicked((p) => (p?.id === s.id ? undefined : s))}
      className={cn(
        "press min-h-11 rounded-xl border-[1.5px] px-3 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        picked?.id === s.id ? "border-leaf bg-leaf-soft text-leaf" : "border-line-2 bg-card hover:bg-paper",
      )}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h3 className="text-label font-semibold text-ink-2">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {first.map((s) => chip(s, slotLabel(s)))}
        {rest.size > 0 && (
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
            className="press min-h-11 rounded-xl border-[1.5px] border-line-2 bg-card px-3 text-label outline-none hover:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {more ? "Fewer times" : "More times"}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {more && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="mt-3 flex flex-col gap-2"
          >
            {[...rest.values()].map((day) => (
              <li key={day[0].id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-mono text-caption text-muted-foreground">
                  {formatWeekday(day[0].startsAt)} {formatMonth(day[0].startsAt)} {formatDayNumber(day[0].startsAt)}
                </span>
                <span className="flex flex-wrap gap-2">{day.map((s) => chip(s, formatClock(s.startsAt)))}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {picked && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={spring.ui} className="mt-4">
            <Button size="lg" disabled={pending} onClick={() => book(picked)} className="press h-11 rounded-full px-5">
              <CalendarCheck aria-hidden />
              {pending ? "Saving..." : `${moving ? "Move to" : "Book"} ${formatWeekday(picked.startsAt)} ${formatClock(picked.startsAt)}`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
