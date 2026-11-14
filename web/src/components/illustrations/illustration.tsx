"use client";

import { animate } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Stage } from "@/lib/api/types";
import { MASCOT_SHAPES, STAGE_SHAPE } from "./mascots";
import { resolveSize } from "./size-map";
import { SHAPES } from "./sizes";
import styles from "./styles";

type FrameProps = {
  /** Accessible name for the whole illustration. Without one it is decorative. */
  label?: string;
  /** Speech bubble shown for a moment when the illustration is tapped. */
  bubble?: string;
  /** Wiggle when tapped. Turn off when the illustration sits inside a link or button. */
  interactive?: boolean;
  /** Small beating heart beside the figure. */
  heart?: boolean;
  /** Seeds per-shape timing so neighbours never move in lockstep. */
  seed?: string;
  className?: string;
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function Frame({ label, bubble, interactive = true, heart = false, seed = "", className, children }: FrameProps & { children: React.ReactNode }) {
  const tapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showBubble, setShowBubble] = useState(false);
  const r = hash(seed);
  const timing = {
    "--bob-dur": `${(4.4 + r * 0.9).toFixed(2)}s`,
    "--bob-delay": `${(-r * 4).toFixed(2)}s`,
    "--blink-dur": `${(5 + hash(seed + "b") * 1.4).toFixed(2)}s`,
    "--blink-delay": `${(-hash(seed + "d") * 5).toFixed(2)}s`,
  } as React.CSSProperties;

  useEffect(() => () => clearTimeout(timer.current), []);

  const tap = useCallback(() => {
    if (bubble) {
      setShowBubble(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShowBubble(false), 2600);
    }
    const el = tapRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Squash to anticipate, stretch up, settle with a small overshoot. null
    // keeps the current value, so a second tap mid-wiggle retargets instead
    // of snapping back to rest.
    animate(
      el,
      {
        rotate: [null, -2, -7, 5, -2, 0],
        scaleX: [null, 1.07, 0.95, 1.03, 0.995, 1],
        scaleY: [null, 0.91, 1.07, 0.98, 1.005, 1],
        y: [null, 3, -14, -4, -1, 0],
      },
      { duration: 0.95, ease: "easeOut", times: [0, 0.14, 0.4, 0.65, 0.85, 1] },
    );
  }, [bubble]);

  const inner = (
    <>
      <span className={styles.bob} style={timing}>
        <span ref={tapRef} className={styles.tap}>
          <svg viewBox="0 0 300 260" className={styles.svg} aria-hidden="true" focusable="false">
            {children}
            {heart && (
              <path
                className={styles.heart}
                d="M50 40c-6-10-22-6-20 6 1 8 12 14 20 20 8-6 19-12 20-20 2-12-14-16-20-6z"
                fill="#E07A52"
              />
            )}
          </svg>
        </span>
      </span>
      {bubble && (
        <span role="status" className={`${styles.bubble} ${showBubble ? styles.bubbleOn : ""}`}>
          {showBubble ? bubble : ""}
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <span
        className={`${styles.stage} ${className ?? ""}`}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {inner}
      </span>
    );
  }
  return (
    <button type="button" onClick={tap} aria-label={label ?? "Say hello"} className={`${styles.stage} ${className ?? ""}`}>
      {inner}
    </button>
  );
}

type SizeProps = FrameProps & {
  /** The API comparison name, for example "zucchini" or "a zucchini". */
  comparison: string;
  week?: number;
};

export function SizeIllustration({ comparison, week, label, heart = true, seed, ...rest }: SizeProps) {
  const { shape, variant } = resolveSize(comparison);
  const name = comparison.replace(/^(a|an)\s+/i, "");
  return (
    <Frame
      {...rest}
      heart={heart}
      seed={seed ?? comparison}
      label={label ?? (week ? `Baby at week ${week}, about the size of a ${name}` : `About the size of a ${name}`)}
    >
      {SHAPES[shape](variant)}
    </Frame>
  );
}

export function StageMascot({ stage, label, heart = false, seed, ...rest }: FrameProps & { stage: Stage }) {
  const Shape = MASCOT_SHAPES[STAGE_SHAPE[stage]];
  return (
    <Frame {...rest} heart={heart} seed={seed ?? stage} label={label}>
      <Shape />
    </Frame>
  );
}
