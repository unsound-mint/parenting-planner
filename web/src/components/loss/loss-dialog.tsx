"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { todayKey } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Confirm before turning on pregnancy loss support (createPregnancyLoss). The
// most sensitive write in the app: plain words, no colour but the neutral
// palette, no success toast, and "Not now" holds the initial focus so a stray
// Enter never records a loss. The date is optional; the API refuses a future one.
export function LossDialog({ memberId, open, onOpenChange }: { memberId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const cancel = useRef<HTMLButtonElement>(null);
  const [occurredOn, setOccurredOn] = useState("");
  const [pending, startTransition] = useTransition();
  const today = todayKey();

  function confirm() {
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/pregnancy-loss", {
        params: { path: { memberId } },
        body: occurredOn ? { occurredOn } : {},
      });
      if (error) {
        toast.error(error.message || "That did not save. Nothing has changed. Please try again.");
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-220 ease-(--ease-out) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <AlertDialog.Popup
          initialFocus={cancel}
          className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none transition-opacity duration-220 ease-(--ease-out) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        >
          <AlertDialog.Title className="text-title">We are so sorry</AlertDialog.Title>
          <AlertDialog.Description render={<div />} className="mt-3 flex flex-col gap-3 text-body text-muted-foreground">
            <p>If you lost the pregnancy, the app can stop everything about it: weeks, the due date, baby checklists and reminders. You will see support instead.</p>
            <p>Grandparents and the nanny are not told why. You can undo this.</p>
          </AlertDialog.Description>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="loss-date" className="text-label">
              When did it happen? <span className="font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input id="loss-date" type="date" max={today} value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className="h-11 font-mono md:h-9" />
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close render={<Button ref={cancel} variant="outline" className="h-11 text-label md:h-9" disabled={pending} />}>Not now</AlertDialog.Close>
            <Button type="button" onClick={confirm} disabled={pending} className="h-11 text-label md:h-9">
              {pending ? "Saving..." : "Stop pregnancy updates"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
