"use client";

import { motion } from "motion/react";

// The one piece of motion on the page: the marker eases in once on mount.
// Opacity and a small scale only; MotionConfig handles reduced motion.
export function YouAreHere() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="flex w-full items-center md:relative md:block md:size-6"
    >
      <span className="size-6 shrink-0 rounded-full border-2 border-primary bg-card md:absolute md:inset-0" aria-hidden />
      <span className="ml-auto rounded-md bg-primary px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-primary-foreground md:absolute md:bottom-full md:left-1/2 md:mb-1.5 md:ml-0 md:-translate-x-1/2">
        You are here
      </span>
    </motion.div>
  );
}
