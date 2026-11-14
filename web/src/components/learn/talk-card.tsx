"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, RefreshCw } from "lucide-react";
import type { Lesson } from "@/lib/api/types";
import { SoftCard } from "@/components/joy/soft-card";
import { ease, spring } from "@/components/joy/motion";
import { useFamilyNow } from "@/components/shell/family-clock";
import { agoWords, type Couple } from "./model";
import type { Talked } from "./lesson-list";

/**
 * "Talk about it tonight": one of the path's talk prompts, the ones not talked
 * about first. "Another question" crossfades to the next; "We talked about it"
 * saves one shared record for the couple. The lesson open in the reader shows
 * its own prompt at its end, so the parent leaves it out (each fact once per screen).
 */
export function TalkCard({ lessons, couple, talked, onTalked }: { lessons: Lesson[]; couple: Couple; talked: Talked; onTalked: (promptId: string) => void }) {
  const now = useFamilyNow();
  const prompts = lessons.filter((l) => l.talkPrompt && !l.locked);
  // Order once per mount (the parent keys the card by path): not talked about
  // first. Marking one keeps it in place instead of swapping the text away.
  const [order] = useState(() => [...prompts.filter((l) => !talked[`lesson:${l.id}`]), ...prompts.filter((l) => talked[`lesson:${l.id}`])].map((l) => l.id));
  const ordered = order.map((id) => prompts.find((l) => l.id === id)).filter((l): l is Lesson => !!l);
  const [i, setI] = useState(0);
  if (ordered.length === 0) return null;
  const lesson = ordered[i % ordered.length];
  const id = `lesson:${lesson.id}`;
  const talk = talked[id];
  const talker = talk && [couple.me, couple.them].find((p) => p?.id === talk.talkedBy);

  return (
    <SoftCard tone="them" as="section" aria-labelledby="talk-title" className="flex flex-col gap-3">
      <p id="talk-title" className="text-caption font-semibold tracking-[0.08em] text-them uppercase">
        Talk about it tonight
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: ease.out }}>
          <p className="text-headline text-balance">{lesson.talkPrompt}</p>
          <p className="mt-2 text-label font-normal text-ink-2">From “{lesson.title}”</p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-1 flex min-h-11 flex-wrap items-center gap-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {talk ? (
            <motion.span key={`done-${id}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={spring.ui} className="inline-flex min-h-11 items-center gap-2 text-label text-them">
              <Check className="size-4" aria-hidden />
              {talker && talker.id !== couple.me.id ? `${talker.displayName} marked it ${agoWords(talk.talkedAt, now)}` : `Talked about ${agoWords(talk.talkedAt, now)}`}
            </motion.span>
          ) : (
            <motion.button
              key={`ask-${id}`}
              type="button"
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              onClick={() => onTalked(id)}
              className="press min-h-11 rounded-full bg-them px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              We talked about it
            </motion.button>
          )}
        </AnimatePresence>
        {ordered.length > 1 && (
          <button
            type="button"
            onClick={() => setI(i + 1)}
            className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-them/35 px-4.5 text-label text-them outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <RefreshCw className="size-4" aria-hidden />
            Another question
          </button>
        )}
      </div>
    </SoftCard>
  );
}
