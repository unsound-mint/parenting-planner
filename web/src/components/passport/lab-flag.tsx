"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, MessageCirclePlus } from "lucide-react";
import { api } from "@/lib/api/client";
import type { LabResult } from "@/lib/api/types";

function rangeText(lab: LabResult): string {
  if (lab.refLow != null && lab.refHigh != null) return `${lab.refLow} to ${lab.refHigh} ${lab.unit}`;
  if (lab.refLow != null) return `at least ${lab.refLow} ${lab.unit}`;
  return `up to ${lab.refHigh} ${lab.unit}`;
}

// The flag under a lab value: the contract's fixed wording, why it is flagged,
// and one action. The only place on the passport that says "discuss with your
// doctor".
// `canAsk` is false for another parent's results: the question endpoint writes
// to the acting parent's own visit list.
export function LabFlag({ lab, memberId, canAsk, owner }: { lab: LabResult; memberId: string; canAsk: boolean; owner?: string }) {
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();
  const flag = lab.flag;
  if (!flag) return null;
  const direction = flag.direction === "low" ? "below" : "above";

  function ask() {
    start(async () => {
      const subject = owner ? `${owner}'s ${lab.name}` : `my ${lab.name}`;
      const { error } = await api.POST("/members/{memberId}/appointment-questions", {
        params: { path: { memberId } },
        body: { text: `Ask about ${subject}: ${lab.value} ${lab.unit}, ${direction} the range of ${rangeText(lab)}.`, visibility: "private" },
      });
      if (error) {
        toast.error(error.code === "no_upcoming_appointment" ? "There is no visit to attach it to yet." : "Could not save the question. Please try again.");
        return;
      }
      setAdded(true);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-status-due-soft px-3 py-2.5 text-status-due">
      <p className="text-label font-semibold">{flag.message}</p>
      {/* Why it is flagged, from the server: the value against the range on
          its own report. Ranges differ between labs, so the report's range is
          the basis, never a range of ours. */}
      <p className="text-label font-normal">{flag.reason}</p>
      {canAsk &&
        (added ? (
          <p className="flex min-h-11 items-center gap-1.5 text-label font-semibold md:min-h-9">
            <Check className="size-4" aria-hidden />
            Added to your next visit
          </p>
        ) : (
          <button
            type="button"
            onClick={ask}
            disabled={pending}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-card px-4 text-label font-semibold outline-none transition-colors duration-150 hover:bg-card/80 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:min-h-9"
          >
            <MessageCirclePlus className="size-4" aria-hidden />
            Add to next visit questions
          </button>
        ))}
    </div>
  );
}
