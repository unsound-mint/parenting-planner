"use client";

import { motion } from "motion/react";
import { ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

/**
 * A sealed envelope. The flap lies shut and a wax stamp presses onto it: the stamp
 * drops from a little above and slightly large, lands, and the wax settles. It
 * runs once when the envelope first appears (`delay` staggers a row of them) and
 * not again. `seal` is the one just created: the flap closes first. Under
 * reduced motion MotionConfig leaves only the fade.
 */
export function Envelope({ tone, opened, delay = 0, seal = false, className }: { tone: "me" | "them"; opened: boolean; delay?: number; seal?: boolean; className?: string }) {
  const wax = tone === "me" ? "fill-me" : "fill-them";
  return (
    <svg viewBox="0 0 160 110" aria-hidden className={cn("h-auto w-full drop-shadow-[0_6px_10px_rgb(120_80_30/0.12)]", className)}>
      <rect x="4" y="14" width="152" height="92" rx="10" className="fill-card stroke-line" strokeWidth="1.5" />
      <path d="M8 22 80 72l72-50" fill="none" className="stroke-line" strokeWidth="1.5" />
      <path d="M8 102 62 56M152 102 98 56" fill="none" className="stroke-line" strokeWidth="1.5" />
      {/* the flap: open envelopes have it folded up, sealed ones lie shut */}
      <motion.path
        d="M4 24a10 10 0 0 1 10-10h132a10 10 0 0 1 10 10L80 74Z"
        className={opened ? "fill-muted stroke-line" : "fill-sun stroke-line"}
        strokeWidth="1.5"
        style={{ transformOrigin: "80px 14px" }}
        initial={seal ? { scaleY: -1 } : false}
        animate={{ scaleY: opened ? -0.9 : 1 }}
        transition={{ duration: 0.4, ease: ease.out }}
      />
      {!opened && (
        <motion.g
          style={{ transformOrigin: "80px 62px" }}
          initial={{ scale: 1.7, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ ...spring.playful, delay: delay + (seal ? 0.35 : 0.2), opacity: { duration: 0.15, delay: delay + (seal ? 0.35 : 0.2) } }}
        >
          <circle cx="80" cy="62" r="17" className={wax} />
          <circle cx="80" cy="62" r="12" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.5" />
          <path d="M80 70c-9-6-9-14-4-15 2 0 4 1 4 3 0-2 2-3 4-3 5 1 5 9-4 15Z" fill="#fff" fillOpacity=".85" />
        </motion.g>
      )}
    </svg>
  );
}
