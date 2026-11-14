"use client";

import { Lock, HeartHandshake } from "lucide-react";
import type { FertilityVisibility } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Who sees one entry: only you, or you and your partner. Nothing wider exists for
 * fertility data, so there is no family or caregiver choice. Private is the default.
 */
export function AudienceChoice({ value, onChange, partnerName, label = "Who can see this" }: { value: FertilityVisibility; onChange: (v: FertilityVisibility) => void; partnerName?: string; label?: string }) {
  const options: { value: FertilityVisibility; label: string; Icon: typeof Lock }[] = [
    { value: "private", label: "Only me", Icon: Lock },
    ...(partnerName ? [{ value: "partner" as const, label: `Me and ${partnerName}`, Icon: HeartHandshake }] : []),
  ];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(({ value: v, label: text, Icon }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cn(
              "press inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
              on ? "border-me bg-me-soft text-ink" : "border-line bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {text}
          </button>
        );
      })}
    </div>
  );
}
