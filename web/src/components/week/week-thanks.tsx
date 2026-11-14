"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import type { ThanksSuggestion as Suggestion } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { ease, spring } from "@/components/joy/motion";
import { ThanksSuggestion } from "@/components/thanks/thanks-suggestion";

/**
 * One thank-you the data suggests ("Thank you for the 3 night feeds on
 * Tuesday"), ready to edit and send. Once sent it settles into a short
 * confirmation; the People page keeps the full list and the sent notes.
 */
export function WeekThanks({ memberId, suggestion, people, className }: { memberId: string; suggestion: Suggestion; people: Person[]; className?: string }) {
  const [sent, setSent] = useState(false);
  const to = people.find((p) => p.id === suggestion.toMemberId);
  return (
    // ThanksSuggestion is its own soft box, so no card around it.
    <div className={className}>
      <AnimatePresence mode="popLayout" initial={false}>
        {sent ? (
          <motion.p
            key="sent"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.ui}
            className="flex items-center gap-2.5 rounded-2xl bg-leaf-soft p-4 text-title"
          >
            <span className="grid size-7 place-items-center rounded-full bg-leaf text-white">
              <Check aria-hidden className="size-4" />
            </span>
            {to ? `${to.displayName} will see it` : "Sent"}
          </motion.p>
        ) : (
          <motion.ul key="form" exit={{ opacity: 0, y: -6, transition: { duration: 0.18, ease: ease.out } }} >
            <ThanksSuggestion memberId={memberId} suggestion={suggestion} people={people} onSent={() => setSent(true)} />
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
