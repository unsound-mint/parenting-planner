"use client";

import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { DiaryEntry, Visibility } from "@/lib/api/types";
import { MoodFace, type Mood } from "@/components/joy/mood-face";
import { MoodPicker } from "@/components/joy/mood-picker";
import { duration, ease, spring } from "@/components/joy/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Audience, type Partner } from "./audience";

/**
 * The journal's front door: a face, a line, save. Private by default; the
 * author can widen one entry to the partner here or later on the entry.
 * Starter chips sit under the line while it is empty, so a blank page always
 * has a way in. There is no voice input: the diary API stores text only, and
 * browser dictation would send private words to a third party.
 */
export function Composer({
  memberId,
  name,
  when,
  partner,
  starters,
  onSaved,
}: {
  memberId: string;
  name: string;
  /** "tonight", "this morning" or "today", from the family's clock. */
  when: string;
  partner?: Partner;
  starters: string[];
  onSaved: (e: DiaryEntry) => void;
}) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ready = body.trim().length > 0 && !pending;

  function start(text: string) {
    setBody(text);
    // Put the caret after the starter so the parent just keeps typing.
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/diary-entries", {
        params: { path: { memberId } },
        body: { body: body.trim(), visibility, ...(mood ? { mood } : {}) },
      });
      if (error || !data) {
        toast.error("Could not save your entry. It is still here, try again.");
        return;
      }
      onSaved(data);
      setBody("");
      setMood(null);
      setVisibility("private");
      setSaved(visibility === "private" ? "Saved, just for you." : `Saved. ${partner?.name ?? "Your partner"} can read it.`);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(null), 2400);
    });
  }

  return (
    <form
      onSubmit={save}
      aria-label="New journal entry"
      className="relative min-w-0 overflow-hidden rounded-[1.75rem] bg-sun p-5.5 md:rounded-[2.25rem] md:p-10"
    >
      {/* The big face mirrors the mood being picked: a quiet echo, not a control. */}
      <div aria-hidden className="pointer-events-none absolute top-6 right-6 hidden size-28 md:block lg:top-8 lg:right-9 lg:size-32">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={mood ?? 0}
            initial={{ opacity: 0, scale: 0.92, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: duration.slow, ease: ease.out }}
            className="size-full"
          >
            <MoodFace mood={mood ?? 4} className={cn("size-full", !mood && "opacity-45")} />
          </motion.div>
        </AnimatePresence>
      </div>

      <h2 className="max-w-[20ch] text-headline text-balance md:text-[2.125rem] md:leading-tight">
        What is on your mind {when}, {name}?
      </h2>

      <MoodPicker value={mood} onChange={(m) => setMood((cur) => (cur === m ? null : m))} size="lg" label="How you feel, if you like" className="mt-6" />

      <label htmlFor="journal-line" className="sr-only">
        Your entry
      </label>
      <textarea
        id="journal-line"
        ref={field}
        value={body}
        maxLength={5000}
        rows={1}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Enter saves a one-liner; Shift+Enter adds a line.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="A word, a line, or more"
        className="mt-6 field-sizing-content block max-h-64 min-h-14 w-full resize-none rounded-3xl bg-card px-5 py-4 text-body shadow-[0_2px_0_rgb(120_80_30/0.06)] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <AnimatePresence initial={false}>
        {body.length === 0 && starters.length > 0 && (
          <motion.ul
            aria-label="Ways to start"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="mt-3.5 flex flex-wrap gap-2"
          >
            {starters.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => start(s)}
                  className="press min-h-9 rounded-full border border-dashed border-line-2 px-3.5 text-label font-normal text-ink-2 outline-none hover:border-solid hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {s}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Audience value={visibility} onChange={setVisibility} partner={partner} />
        <span className="flex-1" />
        <AnimatePresence mode="popLayout" initial={false}>
          {saved ? (
            <motion.p
              key="saved"
              role="status"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.ui}
              className="inline-flex min-h-11 items-center gap-2 text-label text-leaf"
            >
              <Check className="size-4" aria-hidden />
              {saved}
            </motion.p>
          ) : (
            <motion.div key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast }}>
              <Button type="submit" size="lg" disabled={!ready} className="press h-11 rounded-full px-6">
                {pending ? "Saving..." : "Save"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
