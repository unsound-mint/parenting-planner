"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { duration, ease, spring, tap } from "@/components/joy/motion";

/**
 * The paperwork tick. Ticking is a morph, not a swap: the ring fills from the
 * centre, the check draws itself, and a faint ring spreads once. All of it is
 * transform and opacity (the check's stroke draw is a few-pixel SVG path), springs
 * without bounce, and it can be reversed mid-way. Reduced motion keeps the colour
 * change only (MotionConfig turns transforms off).
 */
export function Tick({ done, label, tone, onClick }: { done: boolean; label: string; tone: string; onClick: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={onClick}
      whileTap={tap}
      className="-my-2.5 -ml-2 relative flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="relative flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground/50 bg-card">
        <motion.span
          aria-hidden
          className={cn("absolute -inset-0.5 rounded-full", tone)}
          initial={false}
          animate={{ scale: done ? 1 : 0.4, opacity: done ? 1 : 0 }}
          transition={reduce ? { duration: duration.fast } : spring.ui}
        />
        {done && !reduce && (
          <motion.span
            aria-hidden
            key="burst"
            className={cn("absolute -inset-0.5 rounded-full", tone)}
            initial={{ scale: 1, opacity: 0.35 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: duration.slow, ease: ease.out }}
          />
        )}
        <svg viewBox="0 0 24 24" className="relative size-3.5 text-card" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            initial={false}
            animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ duration: duration.base, ease: ease.out, delay: done ? 0.06 : 0 }}
          />
        </svg>
      </span>
    </motion.button>
  );
}
