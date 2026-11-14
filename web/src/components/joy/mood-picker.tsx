"use client";

import { MOODS, MoodFace, type Mood } from "@/components/joy/mood-face";
import { cn } from "@/lib/utils";

const ORDER: Mood[] = [1, 2, 3, 4, 5];

/**
 * Five faces to pick from, controlled. Faces tilt up on hover (pointer devices
 * only) and grow a little when picked; both are CSS transitions, so a quick
 * change of mind retargets smoothly. Under reduced motion only the colour changes.
 * size "lg" is the journal composer; "md" fits a card.
 */
export function MoodPicker({
  value,
  onChange,
  size = "md",
  label = "How are you feeling",
  className,
}: {
  value: Mood | null;
  onChange: (mood: Mood) => void;
  size?: "md" | "lg";
  label?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex justify-between gap-1 sm:justify-start sm:gap-2.5", className)}>
      {ORDER.map((mood) => {
        const picked = value === mood;
        return (
          <button
            key={mood}
            type="button"
            aria-pressed={picked}
            onClick={() => onChange(mood)}
            className={cn(
              "group press flex min-w-11 flex-col items-center gap-1 rounded-2xl px-1.5 pt-1.5 pb-1 text-caption outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              picked ? "bg-me-soft font-semibold text-me" : "text-muted-foreground hover:text-ink-2",
            )}
          >
            <MoodFace
              mood={mood}
              className={cn(
                "transition-transform duration-(--duration-slow) ease-(--ease-out) motion-reduce:transition-none",
                size === "lg" ? "size-12 sm:size-15" : "size-11 sm:size-13",
                picked ? "scale-110" : "pointer-fine:group-hover:-translate-y-0.75 pointer-fine:group-hover:-rotate-4",
              )}
            />
            {MOODS[mood].label}
          </button>
        );
      })}
    </div>
  );
}
