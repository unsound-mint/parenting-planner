"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Sends a booking request for the acting parent. Nothing reaches a real
// provider; the request is saved and shown as "Requested".
export function BookButton({
  memberId,
  providerId,
  providerName,
  requested,
  compact,
}: {
  memberId: string;
  providerId: string;
  providerName: string;
  requested: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (requested || sent) {
    return (
      <p role="status" className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg bg-status-up-soft px-3 text-label font-semibold text-status-up", compact ? "w-full md:w-36" : "w-full")}>
        <Check className="size-4" aria-hidden />
        Requested
      </p>
    );
  }

  function request() {
    startTransition(async () => {
      const { error, response } = await api.POST("/members/{memberId}/booking-requests", {
        params: { path: { memberId } },
        body: { providerId },
      });
      // 409 means this parent already asked: show the same calm state.
      if (error && response.status !== 409) {
        toast.error("Could not send your request. Please try again.");
        return;
      }
      setSent(true);
      toast.success(`Request sent to ${providerName}. Only you can see it.`);
      router.refresh();
    });
  }

  return (
    <Button size="lg" onClick={request} disabled={pending} className={cn("h-11", compact ? "w-full md:w-36" : "w-full")}>
      <Send aria-hidden />
      {pending ? "Sending..." : "Request a visit"}
    </Button>
  );
}
