"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "@/lib/api/client";
import { duration, ease } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

/**
 * A nudge strip the parent can close for good: it fades and folds away at
 * once, and POST /nudge-dismissals keeps it closed for this parent only.
 * Same close as the partner note in TogetherCard.
 */
export function ClosableNudge({
  memberId,
  id,
  collapseGap = "0rem",
  className,
  children,
}: {
  memberId: string;
  id: string;
  /** The parent's flex gap as a negative margin, so the space folds away with it. */
  collapseGap?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  async function close() {
    setOpen(false);
    const { error } = await api.POST("/members/{memberId}/nudge-dismissals", { params: { path: { memberId } }, body: { id } });
    if (error) {
      setOpen(true);
      toast.error("Could not close that. Please try again.");
    }
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key={id}
          exit={{
            opacity: 0,
            scale: 0.97,
            height: 0,
            marginTop: collapseGap,
            transition: {
              opacity: { duration: duration.fast, ease: ease.out },
              scale: { duration: duration.base, ease: ease.out },
              height: { duration: duration.base, ease: ease.inOut, delay: duration.fast },
              marginTop: { duration: duration.base, ease: ease.inOut, delay: duration.fast },
            },
          }}
          className="overflow-hidden"
        >
          <div className={cn("flex items-center gap-4", className)}>
            {children}
            <button
              type="button"
              aria-label="Close this note"
              onClick={close}
              className="press -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-card hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
