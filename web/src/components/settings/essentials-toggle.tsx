"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Leaf } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";

/**
 * "Essentials only": a per-parent switch that hides detailed tracking (care log
 * details, charts) and keeps the next feed estimate, medicines and appointments.
 * Tracking every nap and diaper can raise anxiety, so it is a choice, not a default.
 */
export function EssentialsToggle({ memberId, initial }: { memberId: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();
  function flip() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const { error } = await api.PUT("/members/{memberId}/preferences", { params: { path: { memberId } }, body: { essentialsOnly: next } });
      if (error) {
        setOn(!next);
        toast.error(error.message ?? "Could not save the setting.");
        return;
      }
      toast.success(next ? "Essentials only is on" : "Showing all tracking");
      router.refresh();
    });
  }
  return (
    <SoftCard as="section" aria-labelledby="essentials-title" tone="leaf" className="flex items-start gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-leaf">
        <Leaf aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="essentials-title" className="text-title">
          Essentials only
        </h2>
        <p className="mt-1 text-label text-ink-2">Counting every nap and diaper can add to the worry. Turn this on to hide the detail and keep the next feed estimate, medicines and appointments. It applies to you only.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Essentials only"
        disabled={pending}
        onClick={flip}
        className="press relative mt-1 flex h-8 w-14 shrink-0 items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={cn("absolute inset-0 rounded-full transition-colors duration-(--duration-base)", on ? "bg-leaf" : "bg-line-2")} />
        <span className={cn("relative ml-1 size-6 rounded-full bg-card shadow-sm transition-transform duration-(--duration-base) ease-(--ease-out)", on && "translate-x-6")} />
      </button>
    </SoftCard>
  );
}
