"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Check, Heart, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Parent, PartnerNudge, TalkPrompt } from "@/lib/api/types";
import { Avatar } from "@/components/joy/partner-chip";
import { SoftCard } from "@/components/joy/soft-card";
import { duration, ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

// "Tonight, together": what the other parent did lately (GET /together nudge)
// and one question to talk about tonight. Baby names have their own card on
// This week (the names quest). Shared between the two parents, never with caregivers.

export function TogetherCard({
  memberId,
  partner,
  nudge,
  prompts,
  className,
}: {
  memberId: string;
  partner: Parent;
  nudge?: PartnerNudge;
  prompts: TalkPrompt[];
  className?: string;
}) {
  // Closing the nudge hides it at once; the server keeps it closed for this parent.
  const [closed, setClosed] = useState<string>();
  const shown = nudge && nudge.id !== closed ? nudge : undefined;

  async function close(n: PartnerNudge) {
    setClosed(n.id);
    const { error } = await api.POST("/members/{memberId}/nudge-dismissals", { params: { path: { memberId } }, body: { id: n.id } });
    if (error) {
      setClosed(undefined);
      toast.error("Could not close that. Please try again.");
    }
  }

  return (
    <SoftCard tone="them" className={cn("flex flex-col", !shown && "justify-center", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown && (
          <motion.div
            key={shown.id}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.base, ease: ease.out } }}
            className="flex items-start gap-3 rounded-2xl bg-card/65 py-3.5 pr-2 pl-4 text-body"
          >
            <Avatar person={partner} size="sm" className="mt-0.5" />
            <p className="min-w-0 flex-1 py-0.5">{shown.text}</p>
            <button
              type="button"
              aria-label="Close this note"
              onClick={() => close(shown)}
              className="press -my-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-card hover:text-ink focus-visible:ring-3 focus-visible:ring-them/40"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* The rest slides up into the nudge's place once it has gone. */}
      <motion.div layout="position" transition={spring.ui}>
        {prompts.length > 0 && <TalkPrompts memberId={memberId} prompts={prompts} first={!shown} />}
      </motion.div>
    </SoftCard>
  );
}

function TalkPrompts({ memberId, prompts, first }: { memberId: string; prompts: TalkPrompt[]; first: boolean }) {
  const [i, setI] = useState(0);
  const [talked, setTalked] = useState<Set<string>>(() => new Set(prompts.filter((p) => p.talkedAt).map((p) => p.id)));
  const [burst, setBurst] = useState(0);
  const prompt = prompts[i % prompts.length];
  const done = talked.has(prompt.id);

  async function markTalked() {
    const id = prompt.id;
    setTalked((s) => new Set(s).add(id));
    setBurst((b) => b + 1);
    const { error } = await api.POST("/members/{memberId}/couple-talks", { params: { path: { memberId } }, body: { promptId: id } });
    if (error) {
      setTalked((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      toast.error("Could not save that. Please try again.");
    }
  }

  return (
    <div className={cn(first ? "" : "mt-5.5")}>
      <p className="text-caption font-semibold tracking-[0.08em] text-them uppercase">Talk about it tonight</p>
      {/* popLayout: the old question leaves while the new one arrives, in the same spot. */}
      <div className="relative mt-2.5 min-h-[5.5em]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={prompt.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="text-headline font-medium text-balance [font-variation-settings:'SOFT'_100,'WONK'_1]"
          >
            {prompt.text}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-4.5 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {done ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring.ui}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-4.5 text-label font-semibold text-them"
              >
                <Check aria-hidden className="size-4" />
                You talked about it
              </motion.span>
            ) : (
              <motion.button
                key="todo"
                type="button"
                onClick={markTalked}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
                className="inline-flex min-h-11 items-center rounded-full bg-them px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-them/40"
              >
                We talked about it
              </motion.button>
            )}
          </AnimatePresence>
          <Celebrate key={burst} on={burst > 0} />
        </div>
        {prompts.length > 1 && (
          <button
            type="button"
            onClick={() => setI((n) => n + 1)}
            className="press inline-flex min-h-11 items-center rounded-full border border-them/35 px-4.5 text-label font-semibold text-them transition-colors duration-(--duration-fast) outline-none hover:bg-card/60 focus-visible:ring-3 focus-visible:ring-them/40"
          >
            Another question
          </button>
        )}
      </div>
    </div>
  );
}

/** A few hearts float up from the button once, when a talk is marked. Playful spring: a small, real milestone. */
function Celebrate({ on }: { on: boolean }) {
  // Hearts are pure movement; under reduced motion the chip's swap says enough.
  const reduce = useReducedMotion();
  if (!on || reduce) return null;
  const hearts = [
    { x: -26, y: -40, r: -14, d: 0, s: 0.9 },
    { x: 6, y: -54, r: 6, d: 0.05, s: 1.1 },
    { x: 34, y: -36, r: 16, d: 0.1, s: 0.8 },
  ];
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {hearts.map((h, n) => (
        <motion.span
          key={n}
          className="absolute -mt-2 -ml-2"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.6, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: h.x, y: h.y, scale: h.s, rotate: h.r }}
          transition={{ ...spring.playful, delay: h.d, opacity: { duration: 0.9, delay: h.d, times: [0, 0.15, 0.7, 1] } }}
        >
          <Heart className="size-4 fill-me-mid text-me-mid" />
        </motion.span>
      ))}
    </span>
  );
}
