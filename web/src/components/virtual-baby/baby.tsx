"use client";

import "./virtual-baby.css";
import { animate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { Face, type FaceExpression } from "@/components/illustrations";
import illustration from "@/components/illustrations/styles";
import type { VirtualBabyAction } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const SKIN = "#F6C9A6";
const SKIN_D = "#EBB48C";

export type Reaction = { action: VirtualBabyAction; warm: boolean; key: number };

type Props = {
  expression: FaceExpression;
  /** Set once per answer; the baby reacts to the action and, when warm, hearts float up. */
  reaction?: Reaction;
  /** Changes when a new moment arrives, so the baby stirs. */
  arrival?: number;
  night?: boolean;
  label: string;
  className?: string;
};

type Keys = { rotate?: (number | null)[]; scaleX?: (number | null)[]; scaleY?: (number | null)[]; y?: (number | null)[]; x?: (number | null)[] };

// One reaction per action. The baby may bob and wiggle (docs/design.md); null
// keeps the current value, so a new reaction retargets instead of snapping.
const REACTIONS: Record<VirtualBabyAction, { keys: Keys; duration: number }> = {
  offer_feed: { keys: { y: [null, -12, 0, -5, 0], scaleY: [null, 1.04, 0.98, 1.01, 1] }, duration: 0.85 },
  change_diaper: { keys: { rotate: [null, -4, 4, -3, 3, 0], y: [null, -4, 0, -3, 0, 0] }, duration: 0.8 },
  lay_down: { keys: { y: [null, 7, 0], rotate: [null, -2, 0], scaleY: [null, 0.97, 1] }, duration: 1 },
  carry: { keys: { x: [null, 14, -4, 0], rotate: [null, 4, -1, 0] }, duration: 0.9 },
  comfort: { keys: { rotate: [null, -6, 6, -5, 5, -2, 0] }, duration: 1.8 },
  wait: { keys: { x: [null, -3, 3, -3, 3, 0] }, duration: 0.5 },
  step_away: { keys: { scaleX: [null, 0.98, 1], scaleY: [null, 0.98, 1] }, duration: 1.4 },
};

/** A wiggle when tapped, like the illustrations' Frame. */
const GIGGLE: Keys = { rotate: [null, -2, -7, 5, -2, 0], scaleX: [null, 1.07, 0.95, 1.03, 0.995, 1], scaleY: [null, 0.91, 1.07, 0.98, 1.005, 1], y: [null, 3, -14, -4, -1, 0] };

/**
 * The Virtual Baby: the newborn mascot's swaddle and bonnet with the shared
 * face, which shows the current need. Idle bob and blink come from
 * illustrations.css; reactions are one-off Motion keyframes on an inner
 * layer, so they compose with the bob and are skipped under reduced motion.
 */
export function VirtualBabyFigure({ expression, reaction, arrival, night = false, label, className }: Props) {
  const react = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  const play = useCallback(
    (keys: Keys, duration: number, ease: "easeOut" | "easeInOut" = "easeOut") => {
      const el = react.current;
      if (!el || reduce) return;
      animate(el, keys as Record<string, (number | null)[]>, { duration, ease });
    },
    [reduce],
  );

  useEffect(() => {
    if (reaction) play(REACTIONS[reaction.action].keys, REACTIONS[reaction.action].duration, reaction.action === "comfort" ? "easeInOut" : "easeOut");
  }, [reaction, play]);

  useEffect(() => {
    if (arrival === undefined || arrival === 0) return;
    if (expression === "sleepy") play({ rotate: [null, 3, -1, 0], y: [null, 4, 0] }, 1.2, "easeInOut");
    else play({ x: [null, -4, 4, -3, 3, 0], rotate: [null, -2, 2, -1, 0] }, 0.6);
    // Only on a new arrival, not when the expression changes for other reasons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival]);

  const asleep = expression === "asleep" || expression === "sleepy";

  return (
    <div className={cn("relative mx-auto w-full", night && "pp-vb-night", className)}>
      <button type="button" aria-label={label} onClick={() => play(GIGGLE, 0.95)} className={cn(illustration.stage, "block")}>
        <span className={illustration.bob} style={{ "--bob-dur": asleep ? "6.2s" : "4.6s" } as React.CSSProperties}>
          <span ref={react} className={illustration.tap}>
            <svg viewBox="0 0 300 260" className={illustration.svg} aria-hidden focusable="false">
              <ellipse cx="150" cy="238" rx="96" ry="12" fill="#2B2620" opacity={night ? 0.18 : 0.08} />
              {/* Swaddle */}
              <path d="M82 150c0-30 136-30 136 0l-8 66c-4 26-116 26-120 0z" fill="#D8EDEB" />
              <path d="M88 168c42 17 82 17 124 0M92 198c38 15 78 15 116 0" stroke="#7DBAB6" strokeWidth="9" strokeLinecap="round" fill="none" />
              <path d="M88 154c32 32 84 38 124 8" stroke="#FFFDF9" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".9" />
              {/* Head and bonnet */}
              <circle cx="100" cy="102" r="9" fill={SKIN_D} />
              <circle cx="200" cy="102" r="9" fill={SKIN_D} />
              <circle cx="150" cy="98" r="54" fill={SKIN} />
              <path d="M98 90c0-42 104-42 104 0-31-13-73-13-104 0z" fill="#F4CD6A" />
              <circle cx="150" cy="44" r="9" fill="#F2B84B" />
              <Face x={150} y={110} s={0.88} expression={expression} />
              {/* A fist to the mouth: the early hunger cue. */}
              {expression === "hungry" && <circle cx="176" cy="132" r="11" fill={SKIN_D} stroke={SKIN} strokeWidth="3" />}
            </svg>
          </span>
        </span>
      </button>
      {asleep && (
        <span aria-hidden className="pointer-events-none absolute top-[6%] right-[22%] text-title">
          {[0, 1.05, 2.1].map((d, i) => (
            <span key={i} className="pp-vb-z" style={{ "--z-delay": `${d}s`, fontSize: `${16 + i * 4}px`, left: `${i * 10}px` } as React.CSSProperties}>
              z
            </span>
          ))}
        </span>
      )}
      {reaction?.warm && <Burst key={reaction.key} />}
    </div>
  );
}

const HEARTS = [
  { x: -46, d: 0, c: "#E07A52", s: 22 },
  { x: 8, d: 0.12, c: "#7DBAB6", s: 18 },
  { x: 52, d: 0.22, c: "#F4CD6A", s: 16 },
  { x: -14, d: 0.32, c: "#E8A07C", s: 14 },
];

function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute top-[22%] left-1/2">
      {HEARTS.map((h, i) => (
        <svg
          key={i}
          viewBox="0 0 40 36"
          width={h.s}
          height={h.s}
          className="pp-vb-burst"
          style={{ "--b-x": `${h.x}px`, "--b-delay": `${h.d}s`, left: `${h.x / 3}px` } as React.CSSProperties}
        >
          <path d="M20 34C8 25 0 19 0 10 0 4 5 0 10 0c4 0 8 2 10 6 2-4 6-6 10-6 5 0 10 4 10 10 0 9-8 15-20 24z" fill={h.c} />
        </svg>
      ))}
    </span>
  );
}
