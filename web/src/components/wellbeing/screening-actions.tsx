"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Lock, MessageCirclePlus, Printer, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import type { MoodScreeningResult, Visibility } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

const pill =
  "inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-4 text-label font-semibold outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:min-h-9";

// Amber: one tap puts a fixed, private question on the next visit. Same
// endpoint and pattern as the lab flag on the passport (LabFlag). The wording
// is fixed here, never generated, and states the score, not a conclusion.
export function VisitQuestion({ memberId, name, r }: { memberId: string; name: string; r: MoodScreeningResult }) {
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();

  function ask() {
    start(async () => {
      const { error } = await api.POST("/members/{memberId}/appointment-questions", {
        params: { path: { memberId } },
        body: { text: `Ask about my ${name} questionnaire: score ${r.score} of ${r.maxScore}, close to the cutoff.`, visibility: "private" },
      });
      if (error) {
        toast.error(error.code === "no_upcoming_appointment" ? "There is no visit to attach it to yet." : "Could not save the question. Please try again.");
        return;
      }
      setAdded(true);
    });
  }

  if (added) {
    return (
      <p className="flex min-h-11 items-center gap-1.5 text-label font-semibold text-status-ok md:min-h-9">
        <Check className="size-4" aria-hidden />
        Added to your next visit
      </p>
    );
  }
  return (
    <button type="button" onClick={ask} disabled={pending} className={`${pill} bg-primary text-primary-foreground hover:bg-primary/90`}>
      <MessageCirclePlus className="size-4" aria-hidden />
      Add to next visit questions
    </button>
  );
}

// Results are private to their author. Sharing is per result, goes only to
// the partner, and needs an explicit confirm. Stopping needs no confirm.
export function ShareControl({ memberId, r, partner, onChange }: { memberId: string; r: MoodScreeningResult; partner?: { name: string }; onChange: (r: MoodScreeningResult) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const shared = r.visibility === "partner";

  function set(visibility: Visibility) {
    start(async () => {
      const { data, error } = await api.PATCH("/members/{memberId}/mood-screenings/{screeningId}", {
        params: { path: { memberId, screeningId: r.id } },
        body: { visibility },
      });
      if (error || !data) {
        toast.error("Could not change who sees this. It stays as it was.");
        return;
      }
      setConfirming(false);
      // The mock answers with a stand-in result; keep the real fields and take only the new setting.
      onChange({ ...r, visibility: data.visibility });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex items-center gap-2 text-label font-semibold">
          {shared ? <Users className="size-4 text-primary" aria-hidden /> : <Lock className="size-4 text-muted-foreground" aria-hidden />}
          {shared ? `Shared with ${partner?.name ?? "your partner"}` : "Only you can see this"}
        </p>
        {partner && !confirming && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => (shared ? set("private") : setConfirming(true))} className="h-11 px-4 md:h-9">
            {shared ? "Stop sharing" : `Share with ${partner.name}`}
          </Button>
        )}
      </div>
      {confirming && partner && (
        <div role="group" aria-label={`Share with ${partner.name}`} className="rounded-xl border border-border bg-muted p-4">
          <p className="text-label font-semibold">Share this result with {partner.name}?</p>
          <p className="mt-1 text-label font-normal text-muted-foreground">{partner.name} will see the band and the score. Not your answers. You can stop sharing at any time.</p>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)} className="h-11 px-4">
              Keep it private
            </Button>
            <Button type="button" disabled={pending} onClick={() => set("partner")} className="h-11 px-4">
              {pending ? "Sharing..." : `Share with ${partner.name}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// For the parent's own doctor: opens a one-page print view of this result.
export function PrintLink({ memberId, resultId }: { memberId: string; resultId: string }) {
  return (
    <Link href={`/family/${memberId}/care/screening/${resultId}/print`} target="_blank" className={`${pill} border border-border bg-card hover:bg-muted`}>
      <Printer className="size-4" aria-hidden />
      Print or save as PDF
    </Link>
  );
}
