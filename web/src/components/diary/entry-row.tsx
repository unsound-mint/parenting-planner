"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, HeartHandshake, ListPlus, Lock, NotebookPen, Pencil, Star, Trash2, X } from "lucide-react";
import type { DiaryEntry, Visibility } from "@/lib/api/types";
import { formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { MoodFace, MOODS, type Mood } from "@/components/joy/mood-face";
import { MoodPicker } from "@/components/joy/mood-picker";
import { PartnerChip } from "@/components/joy/partner-chip";
import { duration, ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { Audience, type Partner } from "./audience";

const TOPIC_MAX = 120;

/** "Fri Nov 13" in the family's zone. */
export function entryDay(iso: string): string {
  return `${formatWeekday(iso)} ${formatMonth(iso)} ${formatDayNumber(iso)}`;
}

/**
 * One journal entry: face, day, text, and on the right who can read it and
 * whether it is on the psychologist's agenda.
 *
 * Own entries: the privacy chip opens the audience switch in place (it morphs,
 * it does not open a panel), and "Bring to <psychologist>" turns into a short
 * title field. Only that title goes to the agenda (the brief), never the text unless the parent switches it on in the brief; the field
 * starts empty on purpose so no private words travel by accident.
 * The partner's shared entries carry their chip and nothing to change.
 * Only the newest entry not yet on the agenda shows "Bring to" outright; on
 * the others it appears on hover or focus (always on touch screens), so the
 * list reads as moments, not a wall of buttons.
 */
export function EntryRow({
  entry,
  mine,
  partner,
  psychologist,
  flash,
  offer,
  onVisibility,
  onBring,
  onEdit,
  onFirst,
  onDelete,
}: {
  entry: DiaryEntry;
  mine: boolean;
  partner?: Partner;
  /** Short name, "Dr. Ellison". */
  psychologist: string;
  flash: boolean;
  /** Show "Bring to" without hover: the newest entry not yet on the agenda. */
  offer: boolean;
  onVisibility: (v: Visibility) => Promise<boolean>;
  /** Resolves true once saved. from is where the title field was, so the topic can fly from it. */
  onBring: (title: string, from: DOMRect | undefined) => Promise<boolean>;
  /** Saves new text and mood; resolves true once saved. */
  onEdit?: (body: string, mood: Mood | undefined) => Promise<boolean>;
  /** Deletes after the inline confirm. */
  /** Marks or unmarks the entry as a first; resolves true once saved. */
  onFirst?: (first: boolean) => Promise<boolean>;
  onDelete?: () => void;
}) {
  const [mode, setMode] = useState<"read" | "edit" | "delete">("read");
  const [draft, setDraft] = useState(entry.body);
  const [draftMood, setDraftMood] = useState<Mood | null>((entry.mood as Mood | undefined) ?? null);
  const [editing, setEditing] = useState<"none" | "audience" | "bring">("none");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const shared = entry.visibility === "partner" || entry.visibility === "family";
  const mood = entry.mood as Mood | undefined;

  async function bring(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await onBring(t, field.current?.getBoundingClientRect());
    setBusy(false);
    if (ok) {
      setEditing("none");
      setTitle("");
    }
  }

  return (
    <article
      id={`entry-${entry.id}`}
      aria-label={`Entry from ${entryDay(entry.writtenAt)}`}
      className={cn(
        "group/entry",
        "grid scroll-mt-24 grid-cols-[2.75rem_1fr] gap-x-4 gap-y-3 rounded-3xl border border-line p-4.5 transition-colors duration-(--duration-slow) ease-(--ease-out) md:grid-cols-[3rem_1fr_auto] md:gap-x-5 md:px-5.5 md:py-5",
        flash ? "bg-sun" : "bg-card",
      )}
    >
      {mood ? (
        <MoodFace mood={mood} title={`Feeling: ${MOODS[mood].label}`} className="size-11" />
      ) : (
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <NotebookPen className="size-5" aria-hidden />
        </span>
      )}

      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-mono text-caption text-muted-foreground">
          <time dateTime={entry.writtenAt}>{entryDay(entry.writtenAt)}</time>
          {entry.first && (
            <span className="inline-flex items-center gap-1 rounded-full bg-butter/60 px-2 py-0.5 font-sans font-semibold text-ink">
              <Star className="size-3 fill-current" aria-hidden />
              A first
            </span>
          )}
          {mine && mode === "read" && (onEdit || onDelete) && (
            <span className="ml-auto inline-flex gap-0.5 font-sans transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-focus-within/entry:opacity-100 pointer-fine:group-hover/entry:opacity-100">
              {onFirst && (
                <IconButton label={entry.first ? "Not a first" : "Mark as a first"} onClick={() => void onFirst(!entry.first)}>
                  <Star className={cn("size-3.5", entry.first && "fill-current")} aria-hidden />
                </IconButton>
              )}
              {onEdit && (
                <IconButton label="Edit entry" onClick={() => setMode("edit")}>
                  <Pencil className="size-3.5" aria-hidden />
                </IconButton>
              )}
              {onDelete && (
                <IconButton label="Delete entry" onClick={() => setMode("delete")}>
                  <Trash2 className="size-3.5" aria-hidden />
                </IconButton>
              )}
            </span>
          )}
        </p>
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === "edit" ? (
            <motion.form
              key="edit"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={spring.ui}
              onSubmit={async (e) => {
                e.preventDefault();
                const text = draft.trim();
                if (!text || busy || !onEdit) return;
                setBusy(true);
                const ok = await onEdit(text, draftMood ?? undefined);
                setBusy(false);
                if (ok) setMode("read");
              }}
              className="mt-2 flex flex-col gap-3"
            >
              <MoodPicker value={draftMood} onChange={setDraftMood} label="How you felt" />
              <label htmlFor={`edit-${entry.id}`} className="sr-only">
                Your entry
              </label>
              <textarea
                id={`edit-${entry.id}`}
                autoFocus
                value={draft}
                maxLength={5000}
                rows={Math.min(8, Math.max(2, draft.split("\n").length + 1))}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setMode("read")}
                className="w-full resize-y rounded-2xl border border-line-2 bg-paper px-4 py-3 text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!draft.trim() || busy}
                  className="press min-h-10 rounded-full bg-me px-4 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(entry.body);
                    setDraftMood((entry.mood as Mood | undefined) ?? null);
                    setMode("read");
                  }}
                  className="press min-h-10 rounded-full px-4 text-label text-ink-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.p
              key="read"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast, ease: ease.out }}
              className="mt-1 text-title font-normal whitespace-pre-line text-ink [font-variation-settings:'SOFT'_50]"
            >
              {entry.body}
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {mode === "delete" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spring.ui}
              role="alertdialog"
              aria-label="Delete this entry?"
              className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-muted px-4 py-2.5"
            >
              <p className="mr-auto text-label text-ink-2">
                Delete this entry?{entry.agendaTopic ? ` Its topic leaves your brief too.` : ""}
              </p>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setMode("read");
                  onDelete?.();
                }}
                className="press min-h-9 rounded-full bg-ink px-4 text-label font-semibold text-paper outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setMode("read")}
                className="press min-h-9 rounded-full px-4 text-label text-ink-2 outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Keep it
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* The side column: who can read it, and the agenda. Under the text on phones. */}
      <div className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-3 md:row-start-1 md:max-w-80 md:flex-col md:items-end">
        {!mine ? (
          partner && <PartnerChip person={{ displayName: partner.name, role: "partner" }}>{partner.name} shared this</PartnerChip>
        ) : (
          <motion.div layout transition={spring.ui} className="flex flex-col items-start gap-2 md:items-end">
            <AnimatePresence mode="popLayout" initial={false}>
              {editing === "audience" ? (
                <motion.div key="switch" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring.ui} className="flex items-center gap-1">
                  <Audience
                    value={entry.visibility}
                    partner={partner}
                    className="bg-muted"
                    onChange={async (v) => {
                      if (await onVisibility(v)) setEditing("none");
                    }}
                  />
                  <CloseButton label="Keep as it is" onClick={() => setEditing("none")} />
                </motion.div>
              ) : (
                <motion.button
                  key={shared ? "shared" : "private"}
                  type="button"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={spring.ui}
                  onClick={() => partner && setEditing("audience")}
                  disabled={!partner}
                  aria-label={partner ? `${shared ? `Shared with ${partner.name}` : "Only you"}. Change who can read it` : "Only you"}
                  className={cn(
                    "press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none",
                    shared ? "bg-them-soft text-them" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {shared ? <HeartHandshake className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                  {shared ? `Shared with ${partner?.name ?? "your partner"}` : "Only you"}
                </motion.button>
              )}
            </AnimatePresence>

            {/* The quiet offer hides on a wrapper: motion sets the button's own opacity inline. */}
            <div
              className={cn(
                !offer &&
                  !entry.agendaTopic &&
                  editing !== "bring" &&
                  "transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-focus-within/entry:opacity-100 pointer-fine:group-hover/entry:opacity-100",
              )}
            >
            <AnimatePresence mode="popLayout" initial={false}>
              {entry.agendaTopic ? (
                <motion.span
                  key="on"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring.ui}
                  title={`Topic: ${entry.agendaTopic}`}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-leaf-soft px-3 text-label text-leaf"
                >
                  <ListPlus className="size-3.5" aria-hidden />
                  In your brief
                </motion.span>
              ) : editing === "bring" ? (
                <motion.form
                  key="bring"
                  onSubmit={bring}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={spring.ui}
                  className="flex w-full flex-col gap-1.5 md:w-72"
                >
                  <div className="flex items-center gap-1 rounded-full bg-me-soft p-1 pl-4">
                    <label htmlFor={`topic-${entry.id}`} className="sr-only">
                      A title for {psychologist}
                    </label>
                    <input
                      id={`topic-${entry.id}`}
                      ref={field}
                      autoFocus
                      value={title}
                      maxLength={TOPIC_MAX}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setEditing("none")}
                      placeholder="Give it a title"
                      className="min-h-9 min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-me/60"
                    />
                    <button
                      type="submit"
                      disabled={!title.trim() || busy}
                      className="press min-h-9 rounded-full bg-me px-3.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <CloseButton label="Cancel" onClick={() => setEditing("none")} />
                  </div>
                  <p className="px-2 text-caption text-muted-foreground">Only the title goes in your brief for {psychologist}.</p>
                </motion.form>
              ) : (
                <motion.button
                  key="offer"
                  type="button"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: duration.fast, ease: ease.out }}
                  onClick={() => setEditing("bring")}
                  className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-me-soft px-4 text-label text-me outline-none hover:bg-me-soft/70 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Bring to {psychologist}
                  <ArrowUpRight className="size-4" aria-hidden />
                </motion.button>
              )}
            </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>
    </article>
  );
}

function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="press flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-card hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="press flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}
