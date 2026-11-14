"use client";

import { cn } from "@/lib/utils";

/** One choice out of a few, as tappable chips (44 px on phones). */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "press min-h-11 rounded-full border px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-10",
              on ? "border-me bg-me-soft font-semibold text-me" : "border-line bg-card text-ink-2 hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
