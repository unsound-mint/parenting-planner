"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Mission } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { ease, stagger } from "@/components/joy/motion";
import { MissionCard } from "./mission-card";

/** Missions as columns: what is taken or finished first, then a few open ones. Swapping hands the slot to the next open mission. */
export function MissionBoard({ memberId, initial, people, shown = 4 }: { memberId: string; initial: Mission[]; people: readonly Person[]; shown?: number }) {
  const [items, setItems] = useState(initial);
  const mine = items.filter((m) => m.state !== "open");
  const open = items.filter((m) => m.state === "open");
  // Open missions fill the slots the taken ones leave, so there are always `shown` things to look at.
  const offered = open.slice(0, Math.max(2, shown - mine.filter((m) => m.state === "taken").length));
  const visible = [...mine, ...offered];
  const replace = (next: Mission) => setItems((all) => all.map((m) => (m.key === next.key ? next : m)));
  const drop = (key: string) => setItems((all) => all.filter((m) => m.key !== key));

  return (
    <ul className="grid gap-4 @3xl:grid-cols-2 @7xl:grid-cols-3">
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((m, i) => (
          <motion.li
            key={m.key}
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out, delay: Math.min(i, 6) * stagger } }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: ease.out } }}
            className="flex min-w-0"
          >
            <MissionCard mission={m} memberId={memberId} people={people} onChange={replace} onSwapped={drop} className="w-full" />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
