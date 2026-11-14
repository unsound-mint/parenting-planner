"use client";

import { motion } from "motion/react";
import type { Parent, VirtualBabySticker } from "@/lib/api/types";
import { spring, stagger } from "@/components/joy/motion";
import { Avatar } from "@/components/joy/partner-chip";
import { cn } from "@/lib/utils";

type StickerId = VirtualBabySticker["id"];

/* Illustrated stickers for taking part (never for which choice was made, and
   never for health data). Flat art on a die-cut white edge, in the
   illustration palette; colours stay inside the SVG like the other illustrations. */

const ART: Record<StickerId, { bg: string; art: React.ReactNode }> = {
  feeding_cues: {
    bg: "#FCEBD5",
    art: (
      <g>
        <rect x="31" y="30" width="18" height="30" rx="7" fill="#FFFDF9" stroke="#E8A07C" strokeWidth="3" />
        <path d="M33 44h14v13a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="#F4CD6A" />
        <rect x="29" y="25" width="22" height="7" rx="3" fill="#E07A52" />
        <path d="M36 25c0-8 8-8 8 0" fill="#E8A07C" />
      </g>
    ),
  },
  fresh_diaper: {
    bg: "#D8EDEB",
    art: (
      <g>
        <path d="M22 32h36l-4 14c-2 8-8 12-14 12s-12-4-14-12z" fill="#FFFDF9" stroke="#7DBAB6" strokeWidth="3" strokeLinejoin="round" />
        <path d="M22 32h36" stroke="#1D6A70" strokeWidth="4" strokeLinecap="round" />
        <circle cx="30" cy="38" r="2.5" fill="#F4CD6A" />
        <circle cx="50" cy="38" r="2.5" fill="#F4CD6A" />
        <path d="M58 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#F4CD6A" />
      </g>
    ),
  },
  back_to_sleep: {
    bg: "#E6EFDC",
    art: (
      <g>
        <rect x="18" y="44" width="44" height="14" rx="5" fill="#FFFDF9" stroke="#3F6B37" strokeWidth="2.5" />
        <path d="M22 44V32M58 44V32" stroke="#3F6B37" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="42" r="7" fill="#F6C9A6" />
        <path d="M27 41c2 2 4 2 6 0" stroke="#2B2620" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M54 18a8 8 0 1 0 6 12 7 7 0 0 1-6-12z" fill="#F4CD6A" />
      </g>
    ),
  },
  calm_and_steady: {
    bg: "#FAE3D5",
    art: (
      <g>
        <path d="M24 46c-6 0-8-10 0-11 1-8 12-10 16-4 6-4 14 1 12 8 7 1 6 9 0 9z" fill="#FFFDF9" stroke="#E8A07C" strokeWidth="2.5" />
        <path d="M40 58c-3-5-11-6-10-11 1-3 6-4 10 0 4-4 9-3 10 0 1 5-7 6-10 11z" fill="#E07A52" />
      </g>
    ),
  },
  tag_team: {
    bg: "#FCEBD5",
    art: (
      <g>
        <path d="M32 54c-6-8-16-10-14-18 2-6 10-6 14 0 4-6 12-6 14 0 2 8-8 10-14 18z" fill="#E07A52" />
        <path d="M48 60c-5-7-14-9-12-16 2-5 9-5 12 0 3-5 10-5 12 0 2 7-7 9-12 16z" fill="#7DBAB6" stroke="#FFFDF9" strokeWidth="2" />
      </g>
    ),
  },
  night_owl: {
    bg: "#4A423A",
    art: (
      <g>
        <path d="M44 22a16 16 0 1 0 14 24 14 14 0 0 1-14-24z" fill="#F4CD6A" />
        <path d="M24 26l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="#FCEBD5" />
        <path d="M58 54l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#FCEBD5" />
      </g>
    ),
  },
  forty_eight: {
    bg: "#F8DDB8",
    art: (
      <g>
        <circle cx="40" cy="40" r="20" fill="#FFFDF9" stroke="#E8A07C" strokeWidth="3" />
        <path d="M40 28v12l8 5" stroke="#2B2620" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="58" cy="22" r="6" fill="#F4CD6A" />
        <path d="M22 54a6 6 0 1 0 6 8 5 5 0 0 1-6-8z" fill="#7DBAB6" />
      </g>
    ),
  },
};

/** What each sticker is for, in the order a family usually meets them. */
export const STICKER_HINTS: { id: StickerId; title: string; hint: string }[] = [
  { id: "feeding_cues", title: "Feeding cues", hint: "Answer a hungry moment" },
  { id: "fresh_diaper", title: "Fresh diaper", hint: "Answer a diaper moment" },
  { id: "back_to_sleep", title: "Back to sleep", hint: "Answer a sleepy moment" },
  { id: "calm_and_steady", title: "Calm and steady", hint: "Answer a crying moment" },
  { id: "tag_team", title: "Tag team", hint: "Both of you take a turn in one session" },
  { id: "night_owl", title: "Night shift", hint: "Answer a moment after midnight in the 48-hour challenge" },
  { id: "forty_eight", title: "48 hours together", hint: "Play the 48-hour challenge to the end" },
];

export function StickerArt({ id, earned = true, className }: { id: StickerId; earned?: boolean; className?: string }) {
  const { bg, art } = ART[id];
  return (
    <svg viewBox="0 0 80 80" className={cn("block", className)} aria-hidden focusable="false">
      {earned ? (
        <>
          <circle cx="40" cy="41.5" r="37" fill="#2B2620" opacity=".08" />
          <circle cx="40" cy="40" r="37" fill="#FFFDF9" />
          <circle cx="40" cy="40" r="31" fill={bg} />
          {art}
        </>
      ) : (
        <circle cx="40" cy="40" r="34" fill="none" stroke="#E3D6C2" strokeWidth="2.5" strokeDasharray="5 6" />
      )}
    </svg>
  );
}

/**
 * The sticker shelf: earned stickers in colour with who earned them, the rest
 * as dashed outlines that say how to earn them. No counts, no ranks.
 * `fresh` stickers (earned in the session just finished) pop in once.
 */
export function StickerShelf({ stickers, parents, fresh = [] }: { stickers: readonly VirtualBabySticker[]; parents: readonly Parent[]; fresh?: readonly StickerId[] }) {
  const earned = new Map(stickers.map((s) => [s.id, s]));
  return (
    <ul className="grid grid-cols-4 gap-x-3 gap-y-4 @md:grid-cols-7 @4xl:grid-cols-4 @7xl:grid-cols-7">
      {STICKER_HINTS.map((h, i) => {
        const s = earned.get(h.id);
        const isFresh = fresh.includes(h.id);
        return (
          <li key={h.id} className="flex min-w-0 flex-col items-center gap-1.5 text-center" title={s ? h.title : `${h.title}: ${h.hint}`}>
            <motion.span
              className="block size-16"
              initial={isFresh ? { scale: 0.6, opacity: 0, rotate: -12 } : false}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ ...spring.playful, delay: isFresh ? 0.2 + i * stagger : 0 }}
            >
              <StickerArt id={h.id} earned={!!s} className="size-16" />
            </motion.span>
            <span className={cn("text-caption leading-tight", s ? "text-ink-2" : "text-muted-foreground")}>{s ? h.title : h.hint}</span>
            {s && (
              <span className="flex -space-x-1" aria-label={`Earned by ${s.earnedBy.map((id) => parents.find((p) => p.id === id)?.displayName ?? "").join(" and ")}`}>
                {s.earnedBy.map((id) => {
                  const p = parents.find((x) => x.id === id);
                  return p ? <Avatar key={id} person={p} size="sm" className="ring-2 ring-card" /> : null;
                })}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
