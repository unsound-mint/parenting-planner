"use client";

import { useState } from "react";
import { BellRing, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// One tap sends the other parent a notification (createLabourAlert). The
// server sends nothing twice inside ten minutes, so a second tap is harmless;
// the button still says what happened.
export function TellPartner({ memberId, name }: { memberId: string; name: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  async function send() {
    if (state === "sending") return;
    setState("sending");
    const { error } = await api.POST("/members/{memberId}/labour-alerts", { params: { path: { memberId } } });
    if (error) {
      setState("idle");
      toast.error(`Could not reach ${name}. Call them instead.`);
      return;
    }
    setState("sent");
  }
  const sent = state === "sent";
  return (
    <button
      type="button"
      onClick={send}
      disabled={state === "sending"}
      className={cn(
        "flex min-h-20 w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        sent ? "bg-status-ok-soft text-status-ok" : "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-background/20">
        {sent ? <Check className="size-6" aria-hidden /> : <BellRing className="size-6" aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-title">{sent ? `${name} knows` : `Tell ${name}`}</span>
        <span role="status" className="block text-label font-normal opacity-80">
          {sent ? "They got a notification. Tap again to remind them." : "Sends a notification, no typing"}
        </span>
      </span>
    </button>
  );
}
