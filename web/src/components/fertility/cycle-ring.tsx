"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type RingProps = {
  /** Cycle length in days: the average once there is an estimate, 28 before. */
  length: number;
  /** Today's day of the cycle, 1 on the first day of bleeding. */
  day: number;
  /** Days of bleeding at the start of this cycle. */
  periodDays: number;
  /** The estimated fertile window as cycle days, absent before an estimate exists. */
  window?: { start: number; end: number; ovulation: number };
  /** Words in the middle, under the day number. */
  caption: string;
  size?: number;
  className?: string;
};

const R = 78;
const C = 2 * Math.PI * R;

/**
 * The cycle as a ring: bleeding days in the parent's accent, the estimated fertile
 * window in green with a hollow dot for the estimated ovulation day, and today as a
 * dark dot. The window is drawn lighter on purpose: it is an estimate, never
 * a promise. Motion: the ring sweeps in once (about 0.9 s, ease-out), then today's dot
 * settles in. Both are CSS transitions, so they collapse under reduced motion.
 */
export function CycleRing({ length, day, periodDays, window: win, caption, size = 220, className }: RingProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const seg = (from: number, to: number) => {
    // Days are 1-based; the ring starts at the top and runs clockwise.
    const a = ((from - 1) / length) * C;
    const b = ((to - from + 1) / length) * C;
    return { strokeDasharray: `${Math.max(b - 2, 1)} ${C - Math.max(b - 2, 1)}`, strokeDashoffset: -a };
  };
  const angle = (d: number) => (((Math.min(d, length) - 0.5) / length) * 360 - 90) * (Math.PI / 180);
  const at = (d: number) => ({ x: 100 + R * Math.cos(angle(d)), y: 100 + R * Math.sin(angle(d)) });
  const today = at(day);
  const ov = win ? at(win.ovulation) : null;

  return (
    <div className={cn("relative mx-auto", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="size-full -rotate-0" role="img" aria-label={`Day ${day} of a ${length} day cycle. ${caption}`}>
        <defs>
          <mask id="cycle-ring-sweep">
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="white"
              strokeWidth="24"
              transform="rotate(-90 100 100)"
              strokeDasharray={C}
              strokeDashoffset={ready ? 0 : C}
              style={{ transition: "stroke-dashoffset 900ms var(--ease-out)" }}
            />
          </mask>
        </defs>
        <g mask="url(#cycle-ring-sweep)" transform="rotate(-90 100 100)" fill="none">
          <circle cx="100" cy="100" r={R} strokeWidth="14" className="stroke-line" />
          <circle cx="100" cy="100" r={R} strokeWidth="14" strokeLinecap="butt" className="stroke-me" style={seg(1, periodDays)} />
          {win && <circle cx="100" cy="100" r={R} strokeWidth="14" className="stroke-leaf/45" style={seg(Math.max(win.start, 1), Math.min(win.end, length))} />}
        </g>
        {ov && <circle cx={ov.x} cy={ov.y} r="5.5" className="fill-card stroke-leaf" strokeWidth="2.5" />}
        <g
          style={{
            transform: ready ? "scale(1)" : "scale(0.4)",
            transformOrigin: `${today.x}px ${today.y}px`,
            opacity: ready ? 1 : 0,
            transition: "transform 320ms var(--ease-out) 700ms, opacity 320ms var(--ease-out) 700ms",
          }}
        >
          <circle cx={today.x} cy={today.y} r="8" className="fill-card" />
          <circle cx={today.x} cy={today.y} r="5.5" className="fill-ink" />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
        <span className="font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">Cycle day</span>
        <span className="text-display text-[2.75rem] leading-none">{day}</span>
        <span className="mt-1 text-caption text-muted-foreground">{caption}</span>
      </div>
    </div>
  );
}
