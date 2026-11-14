"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, Reorder, animate, motion, useDragControls, useReducedMotion } from "motion/react";
import { CalendarCheck, CalendarPlus, GripVertical, Lock, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { AgendaSuggestion, AgendaTopic, Psychologist, PsychologistBooking, Slot } from "@/lib/api/types";
import { dayKey, formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { duration, ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { icsHref } from "./ics";
import { cleanName, shortName } from "./names";

/** The key a topic keeps from its optimistic copy to the server's: the entry it came from, else its id. */
export const topicKey = (t: AgendaTopic) => t.diaryEntryId ?? t.id;

const initials = (name: string) =>
  cleanName(name)
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Where a new topic should come from: take() hands over the rect of the field it was typed in, once; fresh() marks one that should drop in. */
export type Flights = { take: (key: string) => DOMRect | undefined; fresh: (key: string) => boolean };

/**
 * The psychologist card: who she is, the topics for the next session with
 * where each came from, one suggestion, the privacy note, then booking.
 * Topics only: an entry's text never reaches the agenda.
 */
export function AgendaCard({
  memberId,
  psychologist,
  topics,
  origin,
  suggestion,
  nextSession,
  lastSession,
  slots,
  busy,
  flights,
  onAddSuggestion,
  onRemove,
  onReorder,
}: {
  memberId: string;
  psychologist?: Psychologist;
  topics: AgendaTopic[];
  /** "From your journal, Nov 9" and the entry to jump to. */
  origin: (t: AgendaTopic) => { label: string; href?: string };
  suggestion?: AgendaSuggestion;
  nextSession?: PsychologistBooking;
  lastSession?: PsychologistBooking;
  slots: Slot[];
  /** True while a change is on its way; the list cannot be reordered or trimmed meanwhile. */
  busy: boolean;
  flights: Flights;
  onAddSuggestion: (s: AgendaSuggestion) => void;
  onRemove: (t: AgendaTopic) => void;
  onReorder: (next: AgendaTopic[]) => void;
}) {
  const name = psychologist ? cleanName(psychologist.name) : "Your psychologist";
  const short = psychologist ? shortName(psychologist.name) : "your psychologist";
  // While dragging, the order lives here; it is saved once on drop.
  const [order, setOrder] = useState<AgendaTopic[] | null>(null);
  const shown = order ?? topics;

  return (
    // No overflow clip: a topic brought from an entry flies in from outside the card.
    <section aria-labelledby="agenda-title" className="relative min-w-0 rounded-3xl border border-line bg-card p-5.5 md:rounded-[1.75rem] md:p-7">
      <header className="flex items-center gap-3.5">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-leaf-soft font-heading text-title font-semibold text-leaf">
          {psychologist ? initials(psychologist.name) : "?"}
        </span>
        <div className="min-w-0">
          <h2 id="agenda-title" className="text-title font-semibold">
            {name}
          </h2>
          <p className="text-label font-normal text-muted-foreground">
            {psychologist?.focus ?? "Perinatal psychologist"}
            {lastSession && (
              <>
                {" · last session "}
                <span className="font-mono">
                  {formatWeekday(lastSession.startsAt)} {formatMonth(lastSession.startsAt)} {formatDayNumber(lastSession.startsAt)}
                </span>
              </>
            )}
          </p>
        </div>
      </header>

      <h3 className="mt-6 text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">For your next session</h3>
      {shown.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-2 px-4 py-3.5 text-label font-normal text-ink-2">
          Anything you write can become a topic. Tap &ldquo;Bring to {short}&rdquo; on an entry and give it a title.
        </p>
      ) : (
        <Reorder.Group axis="y" values={shown} onReorder={(next) => !busy && setOrder(next)} className="mt-3 flex flex-col gap-2.5">
          {shown.map((t, i) => (
            <TopicRow
              key={topicKey(t)}
              topic={t}
              index={i}
              origin={origin(t)}
              busy={busy}
              flights={flights}
              onRemove={() => onRemove(t)}
              onDrop={() => {
                if (order && order.some((x, j) => x.id !== topics[j]?.id)) onReorder(order);
                setOrder(null);
              }}
            />
          ))}
        </Reorder.Group>
      )}

      <AnimatePresence initial={false}>
        {suggestion && (
          <motion.div
            key={suggestion.text}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={spring.ui}
            className="mt-2.5 flex items-center gap-3 rounded-2xl border border-dashed border-line-2 py-2.5 pr-2.5 pl-4"
          >
            <Sparkles className="size-4 shrink-0 text-me-mid" aria-hidden />
            <p className="min-w-0 flex-1 text-label font-normal text-ink-2">
              {suggestion.reason} Add <strong className="font-semibold text-ink">&ldquo;{suggestion.text}&rdquo;</strong>?
            </p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onAddSuggestion(suggestion)} className="press h-11 shrink-0 rounded-full px-4">
              Add
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 flex gap-3 rounded-2xl bg-leaf-soft px-4 py-3.5 text-label font-normal text-leaf">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        {short} sees the topic title only. Your entries stay yours unless you open one with her.
      </p>

      {nextSession ? <NextSession booking={nextSession} /> : slots.length > 0 && <PickATime memberId={memberId} slots={slots} short={short} />}
    </section>
  );
}

function TopicRow({
  topic,
  index,
  origin,
  busy,
  flights,
  onRemove,
  onDrop,
}: {
  topic: AgendaTopic;
  index: number;
  origin: { label: string; href?: string };
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

function NextSession({ booking }: { booking: PsychologistBooking }) {
  return (
    <div className="mt-6">
      <h3 className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">Your next session</h3>
      <div className="mt-3 flex items-center gap-4 rounded-2xl bg-muted p-3.5">
        <div aria-hidden className="flex w-13 shrink-0 flex-col items-center rounded-xl bg-card py-1.5">
          <span className="font-mono text-caption text-muted-foreground uppercase">{formatMonth(booking.startsAt)}</span>
          <span className="font-heading text-title tabular-nums">{formatDayNumber(booking.startsAt)}</span>
        </div>
        <p className="min-w-0 flex-1 font-mono text-label text-ink-2">
          {formatWeekday(booking.startsAt)} {formatClock(booking.startsAt)} ET · {booking.durationMinutes} min
        </p>
        <a
          href={icsHref(booking)}
          download="session.ics"
          className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-2 bg-card px-4 text-label outline-none hover:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CalendarPlus className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Add to calendar</span>
        </a>
      </div>
    </div>
  );
}

const slotLabel = (s: Slot) => `${formatWeekday(s.startsAt)} ${formatMonth(s.startsAt)} ${formatDayNumber(s.startsAt)}, ${formatClock(s.startsAt)}`;

/** The three soonest times as chips, the rest a tap away; picking one shows the Book button. */
function PickATime({ memberId, slots, short }: { memberId: string; slots: Slot[]; short: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Slot>();
  const [more, setMore] = useState(false);
  const [pending, startTransition] = useTransition();
  const first = slots.slice(0, 3);
  const rest = new Map<string, Slot[]>();
  for (const s of slots.slice(3)) rest.set(dayKey(s.startsAt), [...(rest.get(dayKey(s.startsAt)) ?? []), s]);

  function book(s: Slot) {
    startTransition(async () => {
      const { error, response } = await api.POST("/members/{memberId}/psychologist-bookings", { params: { path: { memberId } }, body: { slotId: s.id } });
      if (error) {
        toast.error(response.status === 409 ? "That time was just taken. Please pick another." : "Could not book that time. Please try again.");
        if (response.status === 409) router.refresh();
        return;
      }
      toast.success(`Booked with ${short}. Your topics go with you.`);
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
    <div className="mt-6">
      <h3 className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">Pick a time</h3>
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
              {pending ? "Booking..." : `Book ${formatWeekday(picked.startsAt)} ${formatClock(picked.startsAt)}`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
