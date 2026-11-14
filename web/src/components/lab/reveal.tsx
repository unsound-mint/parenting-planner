"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Heart, MessageCircle } from "lucide-react";
import type { LabAnswer, LabCard, Parent } from "@/lib/api/types";
import { Avatar } from "@/components/joy/partner-chip";
import { ease, spring } from "@/components/joy/motion";
import { Burst } from "@/components/learn/celebrate";
import { cn } from "@/lib/utils";

const answerText = (card: LabCard, a: LabAnswer) => (a.choiceId === "other" ? (a.otherText ?? "Something else") : (card.choices.find((c) => c.id === a.choiceId)?.label ?? ""));

/**
 * One answer face. The card back (paper with a small heart) shows while it is
 * turned away; both faces turn together, the second one a beat later, when
 * the card scrolls into view the first time or the moment you answer.
 */
function Flip({ person, text, other, tone, delay, fresh }: { person: Parent; text: string; other: boolean; tone: "me" | "them"; delay: number; fresh: boolean }) {
  return (
    <div className="min-w-0 [perspective:900px]">
      <motion.div
        initial={{ rotateY: 180 }}
        {...(fresh ? { animate: { rotateY: 0 } } : { whileInView: { rotateY: 0 }, viewport: { once: true, margin: "0px 0px -12% 0px" } })}
        transition={{ duration: 0.55, ease: ease.inOut, delay }}
        className="relative h-full min-h-32 [transform-style:preserve-3d]"
      >
        <div className={cn("flex h-full flex-col gap-2.5 rounded-2xl p-4 [backface-visibility:hidden]", tone === "me" ? "bg-me-soft" : "bg-them-soft")}>
          <span className="flex items-center gap-2 text-caption font-semibold text-ink-2">
            <Avatar person={person} size="sm" />
            {person.displayName}
          </span>
          <p className={cn("text-body text-balance", other && "italic")}>{other ? `“${text}”` : text}</p>
        </div>
        <div aria-hidden className="absolute inset-0 grid place-items-center rounded-2xl border border-line bg-card [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <Heart className={cn("size-7", tone === "me" ? "text-me-mid" : "text-them-mid")} fill="currentColor" />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * A revealed card: both answers side by side. Where you agree, a small
 * celebration and nothing more to do; where you differ, the conversation
 * prompt, on your talk list until one of you says you talked about it.
 */
export function RevealedCard({
  card,
  me,
  them,
  fresh,
  talkedBy,
  onTalked,
}: {
  card: LabCard;
  me: Parent;
  them: Parent;
  fresh: boolean;
  talkedBy?: Parent;
  onTalked: () => void;
}) {
  const reveal = card.reveal;
  const [party] = useState(fresh);
  if (!reveal || !card.mine) return null;
  const agree = reveal.agree;
  const talkedAt = reveal.talkPrompt.talkedAt;
  return (
    <motion.li layout="position" transition={spring.gentle} className={cn("relative flex min-w-0 flex-col gap-4 rounded-3xl p-5 md:p-6", agree ? "bg-leaf-soft" : "border border-line bg-card")}>
      <p className="flex items-center justify-between gap-3">
        <span className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">{card.topic}</span>
        {agree && (
          <span className="relative inline-flex items-center gap-1.5 text-label font-semibold text-leaf">
            {party && <Burst radius={34} colors={["bg-butter", "bg-me", "bg-them", "bg-leaf"]} />}
            <Check className="size-4" aria-hidden />
            Same page
          </span>
        )}
      </p>
      <h3 className="text-title text-balance">{card.situation}</h3>
      <div className="grid gap-3 @md:grid-cols-2">
        <Flip person={me} text={answerText(card, card.mine)} other={card.mine.choiceId === "other"} tone="me" delay={0} fresh={fresh} />
        <Flip person={them} text={answerText(card, reveal.theirs)} other={reveal.theirs.choiceId === "other"} tone="them" delay={0.14} fresh={fresh} />
      </div>
      {!agree && (
        <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
          <p className="flex gap-2.5 text-body">
            <MessageCircle className="mt-0.5 size-4.5 shrink-0 text-them" aria-hidden />
            <span className="text-balance">{reveal.talkPrompt.text}</span>
          </p>
          {talkedAt ? (
            <p className="inline-flex min-h-11 items-center gap-2 text-label text-them">
              <Check className="size-4" aria-hidden />
              {talkedBy && talkedBy.id !== me.id ? `${talkedBy.displayName} marked this as talked about` : "You talked about it"}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={onTalked} className="press min-h-11 rounded-full bg-them px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                We talked about it
              </button>
              <span className="text-caption text-muted-foreground">On your talk list for tonight</span>
            </div>
          )}
        </div>
      )}
    </motion.li>
  );
}
