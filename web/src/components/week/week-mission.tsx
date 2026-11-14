"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Mission } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { ease } from "@/components/joy/motion";
import { MissionCard } from "@/components/missions/mission-card";
import { pickMission } from "./this-week";

/**
 * One mission on This week. Swapping hands the place to the next open mission
 * (the board on People does the same with its columns); finishing keeps the
 * card, in its done state, until the next visit.
 */
export function WeekMission({ memberId, items, people, className }: { memberId: string; items: Mission[]; people: readonly Person[]; className?: string }) {
  const [list, setList] = useState(items);
  const [key, setKey] = useState(() => pickMission(items)?.key);
  const shown = list.find((m) => m.key === key);
  if (!shown) return null;

  const swapped = (k: string) => {
    const rest = list.filter((m) => m.key !== k);
    setList(rest);
    setKey(rest.find((m) => m.state === "open")?.key);
  };
  const changed = (next: Mission) => setList((all) => all.map((m) => (m.key === next.key ? next : m)));

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={shown.key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: ease.out } }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: ease.out } }}
        className={className}
      >
        {/* Keyed by mission: MissionCard copies its mission into state once. */}
        <MissionCard key={shown.key} mission={shown} memberId={memberId} people={people} onSwapped={swapped} onChange={changed} className="h-full" />
      </motion.div>
    </AnimatePresence>
  );
}
