"use client";

import { motion } from "motion/react";

// The one piece of motion in the timeline: the position dot eases in once on
// mount. Opacity and a small scale only; MotionConfig handles reduced motion.
// The dot sits on the track behind the node circles, so it only shows between
// them. The tag is desktop-only; on phones the current row carries its own.
export function YouAreHere() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="relative size-4"
    >
      <span className="absolute inset-0 rounded-full border-4 border-primary bg-card" aria-hidden />
      <span className="text-caption absolute bottom-full left-1/2 mb-8 hidden -translate-x-1/2 rounded-md bg-primary px-2 font-semibold whitespace-nowrap text-primary-foreground md:block">
        You are here
      </span>
    </motion.div>
  );
}
