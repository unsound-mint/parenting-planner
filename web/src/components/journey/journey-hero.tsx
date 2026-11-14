"use client";

import { motion } from "motion/react";
import { Sprout } from "lucide-react";
import NumberFlow from "@number-flow/react";

const R = 52;

// Progress ring with the one hero number inside. The ring draws in once
// (strokeDashoffset via pathLength, 320 ms ease-out); the text repeats the
// figure for screen readers.
export function JourneyHero({
  progress,
  value,
  unit,
  caption,
  headline,
  support,
}: {
  progress: number;
  value: number | null;
  unit: string;
  caption: string;
  headline: string;
  support: string;
}) {
  return (
    <div className="flex max-w-3xl flex-col items-start gap-4 md:flex-row md:items-center md:gap-8">
      <div className="relative size-32 shrink-0 md:size-40">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-border" />
          {progress > 0 && (
            <motion.circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-primary"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress }}
              transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {value == null ? (
            <Sprout className="size-10 text-primary" aria-hidden />
          ) : (
            <>
              <NumberFlow value={value} className="text-display tabular-nums" />
              <span className="text-caption -mt-1 text-muted-foreground">
                {unit}
                <span className="sr-only"> {caption}</span>
              </span>
            </>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <h1 className="text-headline text-balance">{headline}</h1>
        {support && <p className="text-body mt-2 text-muted-foreground">{support}</p>}
      </div>
    </div>
  );
}
