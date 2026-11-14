"use client";

import { motion } from "motion/react";
import { ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

// A small burst for a real milestone (a lesson finished, both parents done
// with a path, both answered a question): petals in the path's and parents'
// colours fly out a little and fade. It runs once per mount, so the caller
// mounts it with a key when the milestone happens. Under reduced motion
// MotionConfig drops the movement and the petals only fade.

const PETALS = 8;

export function Burst({ colors, radius = 34, className }: { colors: string[]; radius?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 grid place-items-center", className)}>
      {Array.from({ length: PETALS }, (_, i) => {
        const angle = (i / PETALS) * Math.PI * 2 - Math.PI / 2;
        const r = radius * (i % 2 ? 0.8 : 1);
        return (
          <motion.span
            key={i}
            className={cn("absolute rounded-full", i % 2 ? "size-1.5" : "size-2", colors[i % colors.length])}
            initial={{ x: 0, y: 0, scale: 0.6, opacity: 1 }}
            animate={{ x: Math.cos(angle) * r, y: Math.sin(angle) * r, scale: 1, opacity: 0 }}
            transition={{ ...spring.playful, opacity: { duration: 0.6, delay: 0.15, ease: ease.out } }}
          />
        );
      })}
    </span>
  );
}
