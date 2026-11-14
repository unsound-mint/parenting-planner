import type { Transition } from "motion/react";

// The motion vocabulary in one place (docs/design.md, "Motion"). CSS uses the
// same values as tokens in globals.css (--ease-out, --duration-*, --stagger,
// and the press, rise and lift utilities); Motion components use these.
// MotionConfig in providers.tsx already turns transforms off under reduced motion.

/** Cubic-bezier curves, matching --ease-out, --ease-in-out and --ease-drawer. */
export const ease = {
  /** Entering, responding to a tap: fast start, soft landing. The default. */
  out: [0.23, 1, 0.32, 1],
  /** Something already on screen moving or morphing. */
  inOut: [0.77, 0, 0.175, 1],
  /** Sheets and drawers. */
  drawer: [0.32, 0.72, 0, 1],
} as const;

/** Seconds, matching --duration-*. UI stays at or under `slow`; entrances use `enter`. */
export const duration = { press: 0.12, fast: 0.15, base: 0.22, slow: 0.32, enter: 0.4 } as const;

/** Delay between siblings entering, matching --stagger (70 ms). */
export const stagger = 0.07;

export const spring = {
  /** Default UI spring: no bounce. Morphs, layout changes, a card settling into "done". */
  ui: { type: "spring", bounce: 0, duration: 0.32 },
  /** A bigger move (a panel, a topic landing in a list): slower, still no bounce. */
  gentle: { type: "spring", bounce: 0, duration: 0.45 },
  /** Only the baby, mascots and small celebrations (lesson finished, both answered). Never plain UI. */
  playful: { type: "spring", bounce: 0.3, duration: 0.6 },
} satisfies Record<string, Transition>;

/** Press feedback for motion elements; CSS elements use the `press` utility instead. */
export const tap = { scale: 0.97 } as const;
