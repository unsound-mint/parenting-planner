"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { LoadMapShare } from "@/lib/api/types";
import { layers } from "@/lib/load-map";
import type { Person } from "@/lib/roles";
import { roleAccent } from "@/lib/visuals";
import { duration, ease, spring, stagger } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

/**
 * A two-colour (or three with a caregiver) bar of who carries a share. Layers
 * are full-width rectangles scaled from the left edge, so growing in and
 * morphing after a handover are both transform-only and interruptible: a new
 * answer from the API retargets the spring from wherever the bar is.
 * i delays the first grow-in so the rows of a card enter in reading order.
 */
export function SplitBar({
  shares,
  people,
  i = 0,
  thin = false,
  label,
}: {
  shares: LoadMapShare[] | undefined;
  people: Person[];
  i?: number;
  thin?: boolean;
  label: string;
}) {
  // The entrance delay applies only to the first grow-in; later answers retarget at once.
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 1200);
    return () => clearTimeout(t);
  }, []);
  const order = people.filter((p) => p.role === "mother" || p.role === "partner").map((p) => p.id);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative w-full overflow-hidden rounded-full bg-muted", thin ? "h-1.5" : "h-3")}
    >
      {layers(shares, order).map((l, k) => {
        const role = people.find((p) => p.id === l.id)?.role;
        return (
          <motion.div
            key={l.id}
            className={cn("absolute inset-0 origin-left", role ? roleAccent[role].bg : "bg-muted-foreground")}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: l.end }}
            transition={{ scaleX: { ...spring.gentle, delay: entering ? i * stagger + k * 0.05 : 0 }, opacity: { duration: duration.base, ease: ease.out } }}
          />
        );
      })}
    </div>
  );
}
