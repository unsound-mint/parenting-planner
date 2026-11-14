"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

// Undo for a mistaken tap (deletePregnancyLoss): the server restores the stage
// and due date it kept. A family ready to try again changes the stage instead.
export function UndoLoss({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { error } = await api.DELETE("/members/{memberId}/pregnancy-loss", { params: { path: { memberId } } });
          if (error) {
            toast.error(error.message || "That did not save. Please try again.");
            return;
          }
          router.refresh();
        })
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-label text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:min-h-9"
    >
      <Undo2 aria-hidden className="size-4" />
      {pending ? "Restoring..." : "Recorded by mistake? Undo"}
    </button>
  );
}
