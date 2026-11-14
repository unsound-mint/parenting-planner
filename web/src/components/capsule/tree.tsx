"use client";

import { motion } from "motion/react";
import { ease } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

// Leaf slots along the branches, in the order leaves appear.
const SLOTS: [number, number, number][] = [
  [120, 72, -20],
  [86, 98, -60],
  [156, 96, 30],
  [62, 128, -80],
  [184, 124, 55],
  [104, 52, -5],
  [140, 54, 10],
  [78, 76, -40],
  [168, 74, 40],
  [118, 104, 0],
  [50, 98, -70],
  [196, 98, 70],
];

/**
 * A small tree that grows one leaf per letter, in the author's colour. Gentle
 * on purpose: the trunk is still, the leaves ease in one after another.
 */
export function LetterTree({ leaves, className }: { leaves: ("me" | "them")[]; className?: string }) {
  return (
    <svg viewBox="0 0 240 190" aria-hidden className={cn("h-auto w-full", className)}>
      <ellipse cx="120" cy="176" rx="70" ry="9" className="fill-line" />
      <path d="M112 176c2-34 2-62-2-86M128 176c-2-34-2-60 2-84" fill="none" className="stroke-mom" strokeWidth="8" strokeLinecap="round" />
      <path d="M112 118c-22-6-38-18-52-40M128 108c22-6 40-16 56-38M118 92c-14-8-20-22-18-40M124 90c14-8 22-24 20-38" fill="none" className="stroke-mom" strokeWidth="5" strokeLinecap="round" />
      {SLOTS.slice(0, leaves.length).map(([x, y, r], i) => (
        <motion.path
          key={i}
          d="M0 0c10-6 18 2 16 12-10 4-20-2-16-12Z"
          className={leaves[i] === "me" ? "fill-me" : "fill-them"}
          style={{ transformOrigin: "0px 0px", x, y, rotate: r }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: ease.out, delay: 0.25 + i * 0.09 }}
        />
      ))}
    </svg>
  );
}
