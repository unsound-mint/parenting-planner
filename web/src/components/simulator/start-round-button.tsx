"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Repeat } from "lucide-react";
import { api } from "@/lib/api/client";
import type { SimulatorRound } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

type Props = {
  memberId: string;
  mode: SimulatorRound["mode"];
  scenarioId?: string;
  label: string;
  variant?: "default" | "secondary" | "outline";
};

// Starts a round, then opens it on its own page so a reload resumes it.
export function StartRoundButton({ memberId, mode, scenarioId, label, variant = "default" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = mode === "practice" ? Repeat : Play;

  function start() {
    startTransition(async () => {
      const { data, error } = await api.POST("/members/{memberId}/simulator-rounds", {
        params: { path: { memberId } },
        body: { mode, scenarioId },
      });
      if (error || !data) {
        toast.error(error?.code === "nothing_to_practice" ? "Play one scenario first." : "Could not start. Please try again.");
        return;
      }
      router.push(`/family/${memberId}/simulator/${data.id}`);
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={start}
      disabled={pending}
      className="press h-11 gap-2 rounded-full px-4.5 text-label"
    >
      <Icon className="size-4" aria-hidden />
      {pending ? "Starting..." : label}
    </Button>
  );
}
