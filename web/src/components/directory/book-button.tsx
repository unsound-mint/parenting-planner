"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

// Sends a booking request for the acting parent. Nothing reaches a real
// provider; the request is saved and shown as "Requested".
export function BookButton({
  memberId,
  providerId,
  providerName,
  requested,
}: {
  memberId: string;
  providerId: string;
  providerName: string;
  requested: boolean;
}) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (requested || sent) {
    return (
      <Button variant="secondary" size="lg" disabled className="w-full opacity-100 disabled:opacity-100">
        <Check aria-hidden />
        Requested
      </Button>
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
    <Button size="lg" onClick={request} disabled={pending} className="w-full">
      <Send aria-hidden />
      {pending ? "Sending..." : "Request a visit"}
    </Button>
  );
}
