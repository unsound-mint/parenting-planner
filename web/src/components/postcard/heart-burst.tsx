"use client";

import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ease } from "@/components/joy/motion";

// Eight hearts leave the button in a fan and fade. Transform and opacity only,
// about 0.9 s, once per tap; mount it with a new key for each burst. A person
// who asks for reduced motion gets none (the button's own state change says
// the love was sent).
const HEARTS = [
  { x: -78, y: -112, r: -24, s: 1 },
  { x: -46, y: -150, r: -10, s: 0.8 },
  { x: -18, y: -118, r: 8, s: 1.15 },
  { x: 14, y: -164, r: -6, s: 0.9 },
  { x: 42, y: -124, r: 14, s: 1.05 },
  { x: 72, y: -152, r: 22, s: 0.85 },
  { x: 96, y: -108, r: 30, s: 0.95 },
  { x: -98, y: -86, r: -32, s: 0.75 },
];

export function HeartBurst() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center">
      {HEARTS.map((h, i) => (
        <motion.span
          key={i}
          className="absolute text-mom"
          initial={{ opacity: 0, scale: 0.4, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, h.s, h.s, h.s * 0.85], x: h.x, y: h.y, rotate: h.r }}
          transition={{ duration: 0.9, ease: ease.out, times: [0, 0.15, 0.65, 1], delay: i * 0.02 }}
        >
          <Heart className="size-6 fill-current" />
        </motion.span>
      ))}
    </span>
  );
}
