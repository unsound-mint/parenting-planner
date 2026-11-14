"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A number that counts up on first render and eases to its new value when it changes.
 * The markup holds the final value, so the first paint and a screen reader see the right figure.
 * Reduced motion: no counting.
 */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => {
        from.current = v;
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce, format]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(value)}
    </span>
  );
}

function useMounted() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

/** A bar that grows from its left edge to `ratio` (0 to 1) and retargets smoothly when it changes. Transform only. */
export function GrowBar({ ratio, delay = 0, className }: { ratio: number; delay?: number; className?: string }) {
  const on = useMounted();
  return (
    <span
      aria-hidden
      className={cn("block h-full origin-left rounded-full transition-transform duration-[400ms] ease-(--ease-out) motion-reduce:transition-none", className)}
      style={{ transform: `scaleX(${on ? Math.max(0, Math.min(1, ratio)) : 0})`, transitionDelay: `${delay}ms` }}
    />
  );
}

/** Reveals its children from the left once, with a clip-path wipe. */
export function Wipe({ children, className }: { children: React.ReactNode; className?: string }) {
  const on = useMounted();
  return (
    <div
      className={cn("transition-[clip-path] duration-[600ms] ease-(--ease-out) motion-reduce:transition-none", className)}
      style={{ clipPath: on ? "inset(0 0 0 0 round 999px)" : "inset(0 100% 0 0 round 999px)" }}
    >
      {children}
    </div>
  );
}
