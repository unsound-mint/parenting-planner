"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, Reorder, motion } from "motion/react";
import { CalendarPlus, CalendarX, Check, Clock, FileText, Lock, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { AgendaSuggestion, AgendaTopic, MoodSummary, Psychologist, PsychologistBooking, SessionBrief, Slot } from "@/lib/api/types";
import { formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PickATime, TopicRow, initials, topicKey, type Flights } from "./agenda-parts";
import { icsHref } from "./ics";
import { cleanName, shortName } from "./names";
import { Sparkline, moodWords } from "./brief-mood";

const when = (iso: string) => `${formatWeekday(iso)} ${formatMonth(iso)} ${formatDayNumber(iso)}, ${formatClock(iso)} ET`;

/**
 * The psychologist card, built around the session brief: the next session
 * (real booking, movable and cancellable), what the parent brings (agenda
 * topics, the text of entries they choose, an optional summary of their own
 * check-ins and a note), and how it reaches the psychologist. Nothing leaves
 * the app until the parent schedules or sends it; from then on the card shows
 * the frozen copy that was (or will be) sent, and the PDF is that copy.
 */
export function BriefCard({
  memberId,
  psychologist,
  topics,
  origin,
  suggestion,
  lastSession,
  slots,
  brief: serverBrief,
  busy,
  flights,
  onAddSuggestion,
  onRemove,
  onReorder,
}: {
  memberId: string;
  psychologist?: Psychologist;
  topics: AgendaTopic[];
  origin: (t: AgendaTopic) => { label: string; href?: string };
  suggestion?: AgendaSuggestion;
  lastSession?: PsychologistBooking;
  slots: Slot[];
  brief?: SessionBrief;
  busy: boolean;
  flights: Flights;
  onAddSuggestion: (s: AgendaSuggestion) => void;
  onRemove: (t: AgendaTopic) => void;
  onReorder: (next: AgendaTopic[]) => void;
}) {
  const router = useRouter();
  const name = psychologist ? cleanName(psychologist.name) : "Your psychologist";
  const short = psychologist ? shortName(psychologist.name) : "your psychologist";
  const [order, setOrder] = useState<AgendaTopic[] | null>(null);
  const shown = order ?? topics;

  // The brief as last saved; a new server render resets it.
  const [src, setSrc] = useState(serverBrief);
  const [brief, setBrief] = useState(serverBrief);
  const [note, setNote] = useState(serverBrief?.note ?? "");
  if (src !== serverBrief) {
    setSrc(serverBrief);
    setBrief(serverBrief);
    setNote(serverBrief?.note ?? "");
  }
  const [saving, startSaving] = useTransition();
  const session = brief?.session;
  const frozen = brief?.status === "scheduled" || brief?.status === "sent";
  const onAgenda = new Set(topics.map((t) => t.diaryEntryId).filter(Boolean));
  const sharedIds = (brief?.sharedEntryIds ?? []).filter((id) => onAgenda.has(id));

  function save(change: Partial<{ status: SessionBrief["status"]; includeMood: boolean; sharedEntryIds: string[]; note: string }>, done?: (b: SessionBrief) => string) {
    if (!brief) return;
    const body = {
      status: change.status ?? "draft",
      includeMood: change.includeMood ?? brief.includeMood,
      sharedEntryIds: change.sharedEntryIds ?? sharedIds,
      note: change.note ?? note,
    };
    const undo = brief;
    if (body.status === "draft") setBrief({ ...brief, includeMood: body.includeMood, sharedEntryIds: body.sharedEntryIds });
    startSaving(async () => {
      const { data, error, response } = await api.PUT("/members/{memberId}/session-brief", { params: { path: { memberId } }, body });
      if (error || !data) {
        setBrief(undo);
        toast.error(response.status === 409 ? "That brief has already gone out." : "Could not save the brief. Please try again.");
        if (response.status === 409) router.refresh();
        return;
      }
      setBrief(data);
      if (done) toast.success(done(data));
    });
  }

  const toggleEntry = (id: string) => save({ sharedEntryIds: sharedIds.includes(id) ? sharedIds.filter((x) => x !== id) : [...sharedIds, id] });

  return (
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

      <SessionRow memberId={memberId} session={session} slots={slots} short={short} />

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h3 className="text-label font-semibold text-ink-2">Your brief for {short}</h3>
        {brief && <StatusChip brief={brief} />}
      </div>

      {frozen && brief ? (
        <FrozenItems brief={brief} />
      ) : shown.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-2 px-4 py-3.5 text-label font-normal text-ink-2">
          Anything you write can go in it. Tap &ldquo;Bring to {short}&rdquo; on an entry and give it a title.
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
              extra={
                t.diaryEntryId && brief ? (
                  <ShareText on={sharedIds.includes(t.diaryEntryId)} disabled={saving || busy} onToggle={() => toggleEntry(t.diaryEntryId!)} />
                ) : undefined
              }
            />
          ))}
        </Reorder.Group>
      )}

      {!frozen && (
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
      )}

      {brief?.mood && (frozen ? brief.includeMood : true) && (
        <MoodRow mood={brief.mood} on={brief.includeMood} frozen={frozen} disabled={saving} onToggle={() => save({ includeMood: !brief.includeMood })} />
      )}

      {brief && !frozen && (
        <div className="mt-3">
          <label htmlFor="brief-note" className="text-caption text-muted-foreground">
            A note for {short}, if you like
          </label>
          <textarea
            id="brief-note"
            value={note}
            maxLength={1500}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== (brief.note ?? "") && save({ note })}
            placeholder="What you would like to start with"
            className="mt-1 w-full resize-y rounded-2xl border border-line-2 bg-paper px-4 py-2.5 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}
      {frozen && brief?.note && <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-label whitespace-pre-line text-ink-2">{brief.note}</p>}

      {brief && <Delivery memberId={memberId} brief={brief} short={short} saving={saving} onSave={save} note={note} />}
    </section>
  );
}

function StatusChip({ brief }: { brief: SessionBrief }) {
  const { status } = brief;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={spring.ui}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold",
          status === "draft" && "bg-muted text-muted-foreground",
          status === "scheduled" && "bg-me-soft text-me",
          status === "sent" && "bg-leaf-soft text-leaf",
        )}
      >
        {status === "draft" ? <Lock className="size-3" aria-hidden /> : status === "scheduled" ? <Clock className="size-3" aria-hidden /> : <Check className="size-3" aria-hidden />}
        {status === "draft" ? "Only you see it" : status === "scheduled" ? "Scheduled" : "Sent"}
      </motion.span>
    </AnimatePresence>
  );
}

function ShareText({ on, disabled, onToggle }: { on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="mt-1.5 inline-flex min-h-8 items-center gap-2 rounded-full text-caption text-ink-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <Switch on={on} />
      {on ? "What you wrote goes with it" : "Title only"}
    </button>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn("relative inline-flex h-4.5 w-8 shrink-0 rounded-full transition-colors duration-(--duration-fast)", on ? "bg-leaf" : "bg-line-2")}>
      <span className={cn("absolute top-0.5 left-0.5 size-3.5 rounded-full bg-card shadow-sm transition-transform duration-(--duration-fast) ease-(--ease-out)", on && "translate-x-3.5")} />
    </span>
  );
}

/** A small picture of the two weeks and what it says, with the include switch. */
function MoodRow({ mood, on, frozen, disabled, onToggle }: { mood: MoodSummary; on: boolean; frozen: boolean; disabled: boolean; onToggle: () => void }) {
  const words = moodWords(mood);
  const body = (
    <>
      <Sparkline mood={mood} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-label font-semibold text-ink">Your check-ins, last two weeks</span>
        <span className="block text-caption text-muted-foreground">{words}</span>
      </span>
    </>
  );
  if (frozen) return <div className="mt-3 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">{body}</div>;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled || mood.checkins === 0}
      onClick={onToggle}
      className={cn(
        "press mt-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
        on ? "border-leaf/40 bg-leaf-soft/60" : "border-dashed border-line-2",
      )}
    >
      {body}
      <Switch on={on} />
    </button>
  );
}

function FrozenItems({ brief }: { brief: SessionBrief }) {
  if (brief.items.length === 0) return <p className="mt-3 text-label text-muted-foreground">No topics in this brief.</p>;
  return (
    <ol className="mt-3 flex flex-col gap-2.5">
      {brief.items.map((it, i) => (
        <li key={`${i}-${it.text}`} className="grid grid-cols-[1.75rem_1fr] items-start gap-3 rounded-2xl bg-muted py-3 pr-3 pl-3.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-card font-heading text-label font-semibold text-ink-2">{i + 1}</span>
          <div className="min-w-0 py-0.5">
            <p className="text-body font-semibold text-ink">{it.text}</p>
            {it.entryText ? (
              <p className="mt-1 line-clamp-3 text-label font-normal whitespace-pre-line text-ink-2">{it.entryText}</p>
            ) : (
              <p className="text-caption text-muted-foreground">{it.diaryEntryId ? "Title only" : "From your check-ins"}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** How the brief reaches the psychologist: scheduled for the day before, or handed over by the parent. */
function Delivery({
  memberId,
  brief,
  short,
  saving,
  note,
  onSave,
}: {
  memberId: string;
  brief: SessionBrief;
  short: string;
  saving: boolean;
  note: string;
  onSave: (change: { status: SessionBrief["status"]; note?: string }, done?: (b: SessionBrief) => string) => void;
}) {
  const session = brief.session;
  const pdf = (
    <Link
      href={`/family/${memberId}/care/brief/print`}
      className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-2 bg-card px-4 text-label outline-none hover:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <FileText className="size-4" aria-hidden />
      {brief.status === "draft" ? "Preview PDF" : "Open PDF"}
    </Link>
  );
  const dayBefore = session ? new Date(Date.parse(session.startsAt) - 86_400_000).toISOString() : undefined;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={brief.status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.ui}>
          {brief.status === "draft" && (
            <>
              <p className="flex gap-2.5 text-label font-normal text-leaf">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                {short} sees nothing until you send it, and then only what the PDF shows.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="lg"
                  disabled={!session || saving}
                  onClick={() => onSave({ status: "scheduled", note }, (b) => (b.status === "scheduled" && b.sendAt ? `It goes to ${short} ${when(b.sendAt)}.` : `Sent to ${short}.`))}
                  className="press h-11 rounded-full px-5"
                >
                  <Send aria-hidden />
                  {dayBefore ? `Send the day before · ${formatWeekday(dayBefore)} ${formatClock(dayBefore)}` : "Send the day before"}
                </Button>
                {pdf}
              </div>
              {session ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onSave({ status: "sent", note }, () => `Marked as given to ${short}.`)}
                  className="mt-2 text-caption text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink"
                >
                  I gave it to {short} myself
                </button>
              ) : (
                <p className="mt-2 text-caption text-muted-foreground">Book a session to send it.</p>
              )}
            </>
          )}
          {brief.status === "scheduled" && brief.sendAt && (
            <>
              <p className="text-body">
                Goes to {short} <span className="font-mono text-label">{when(brief.sendAt)}</span>, the day before your session.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {pdf}
                <Button variant="outline" size="lg" disabled={saving} onClick={() => onSave({ status: "draft", note }, () => "Not sending it yet. Change what you like.")} className="press h-11 rounded-full px-4">
                  Change it
                </Button>
              </div>
            </>
          )}
          {brief.status === "sent" && (
            <>
              <p className="flex items-center gap-2 text-body text-leaf">
                <Check className="size-4" aria-hidden />
                With {short}
                {brief.sentAt && <span className="font-mono text-label text-muted-foreground">since {when(brief.sentAt)}</span>}
              </p>
              <div className="mt-3">{pdf}</div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** The booked session with move and cancel, or a way to book one. */
function SessionRow({ memberId, session, slots, short }: { memberId: string; session?: PsychologistBooking; slots: Slot[]; short: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "move" | "cancel" | "book">("none");
  const [pending, start] = useTransition();

  function cancel(b: PsychologistBooking) {
    start(async () => {
      const { error } = await api.DELETE("/members/{memberId}/psychologist-bookings/{bookingId}", { params: { path: { memberId, bookingId: b.id } } });
      if (error) {
        toast.error("Could not cancel the session. Please try again.");
        return;
      }
      toast.success("Session cancelled. Your brief stays as a draft.");
      setMode("none");
      router.refresh();
    });
  }

  if (!session) {
    return (
      <div className="mt-6 rounded-2xl bg-muted p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarPlus className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-label text-ink-2">No session booked yet.</p>
          {slots.length > 0 && mode !== "book" && (
            <Button size="lg" onClick={() => setMode("book")} className="press h-11 rounded-full px-4">
              See {short}&apos;s open times
            </Button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {mode === "book" && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.ui} className="mt-4">
              <PickATime memberId={memberId} slots={slots} short={short} title={`Times ${short} has open`} onDone={() => setMode("none")} />
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-3 text-caption text-muted-foreground">
          Looking for someone else?{" "}
          <Link href={`/family/${memberId}/directory`} className="underline decoration-line-2 underline-offset-3 hover:text-ink">
            Find help near you
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-muted p-3.5">
        <div aria-hidden className="flex w-13 shrink-0 flex-col items-center rounded-xl bg-card py-1.5">
          <span className="font-mono text-caption text-muted-foreground uppercase">{formatMonth(session.startsAt)}</span>
          <span className="font-heading text-title tabular-nums">{formatDayNumber(session.startsAt)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-ink">Your next session</p>
          <p className="font-mono text-label text-ink-2">
            {formatWeekday(session.startsAt)} {formatClock(session.startsAt)} ET · {session.durationMinutes} min
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a
            href={icsHref(session)}
            download="session.ics"
            aria-label="Add to calendar"
            title="Add to calendar"
            className="press inline-flex size-11 items-center justify-center rounded-full border border-line-2 bg-card outline-none hover:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CalendarPlus className="size-4" aria-hidden />
          </a>
          <Button variant="outline" size="lg" aria-expanded={mode === "move"} onClick={() => setMode((m) => (m === "move" ? "none" : "move"))} className="press h-11 rounded-full px-4">
            Move
          </Button>
          <Button variant="outline" size="lg" aria-expanded={mode === "cancel"} onClick={() => setMode((m) => (m === "cancel" ? "none" : "cancel"))} className="press h-11 rounded-full px-4">
            Cancel
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {mode === "move" && (
          <motion.div key="move" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.ui} className="mt-4">
            {slots.length > 0 ? (
              <PickATime memberId={memberId} slots={slots} short={short} moving={session} title={`Other times ${short} has open`} onDone={() => setMode("none")} />
            ) : (
              <p className="text-label text-muted-foreground">{short} has no other open times in the next two weeks.</p>
            )}
          </motion.div>
        )}
        {mode === "cancel" && (
          <motion.div
            key="cancel"
            role="alertdialog"
            aria-label="Cancel this session?"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring.ui}
            className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line-2 px-4 py-3"
          >
            <p className="mr-auto text-label text-ink-2">Cancel {formatWeekday(session.startsAt)}&apos;s session? Your brief stays as a draft and is not sent.</p>
            <Button size="lg" disabled={pending} onClick={() => cancel(session)} className="press h-10 rounded-full px-4">
              <CalendarX aria-hidden />
              {pending ? "Cancelling..." : "Cancel session"}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setMode("none")} className="press h-10 rounded-full px-4">
              Keep it
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
