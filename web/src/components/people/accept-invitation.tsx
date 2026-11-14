"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

export function AcceptInvitation({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [done, setDone] = useState(false);

  function accept() {
    startTransition(async () => {
      const { data, error } = await api.POST("/invitations/{token}/accept", { params: { path: { token } } });
      if (error || !data) {
        toast.error(error?.message ?? "Could not accept. The link may have been used.");
        return;
      }
      setDone(true);
      // The response replaced this browser's session cookie; the new member id is a new route, so nothing cached applies.
      router.push(`/family/${data.memberId}`);
    });
  }

  return (
    <Button size="lg" disabled={pending || done} onClick={accept} className="h-12 w-full text-body font-semibold">
      {pending || done ? "Opening your view..." : "Accept and open"}
    </Button>
  );
}
