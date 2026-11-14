"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { HeartHandshake, Lock } from "lucide-react";
import type { Visibility } from "@/lib/api/types";
import { spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

export type Partner = { id: string; name: string };

/**
 * Who may read an entry: only me, or me and the partner. A segmented pill
 * whose highlight slides between the two (shared layout, spring.ui), so the
 * choice reads as one switch changing state rather than two buttons. Private is
 * the default everywhere; the server never widens it. With no partner in the
 * family only "Only you" shows, as a plain chip.
 */
export function Audience({
  value,
  onChange,
  partner,
  className,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  partner?: Partner;
  className?: string;
}) {
  const id = useId();
  if (!partner) {
    return (
      <span className={cn("inline-flex min-h-9 items-center gap-1.5 text-label text-muted-foreground", className)}>
        <Lock className="size-3.5" aria-hidden />
        Only you
      </span>
    );
  }
  // "family" also reaches the partner; anything else stays with the author.
  const shared = value === "partner" || value === "family";
  const options = [
    { v: "private" as const, on: !shared, label: "Only you", icon: Lock },
    { v: "partner" as const, on: shared, label: `You and ${partner.name}`, icon: HeartHandshake },
  ];
  return (
    <div role="radiogroup" aria-label="Who can read this entry" className={cn("inline-flex rounded-full bg-card/70 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={o.on}
          onClick={() => !o.on && onChange(o.v)}
          className={cn(
            "press relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            o.on ? (o.v === "private" ? "text-ink" : "text-them") : "text-muted-foreground hover:text-ink-2",
          )}
        >
          {o.on && (
            <motion.span
              layoutId={`audience-${id}`}
              transition={spring.ui}
              aria-hidden
              className={cn("absolute inset-0 rounded-full shadow-[0_1px_0_rgb(120_80_30/0.08)]", o.v === "private" ? "bg-card" : "bg-them-soft")}
            />
          )}
          <o.icon className="relative size-3.5" aria-hidden />
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
