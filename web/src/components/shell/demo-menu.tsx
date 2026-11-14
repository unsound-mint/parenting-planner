"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Crown, FlaskConical, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DemoClock } from "./demo-clock";
import { ResetDemo } from "./reset-demo";

// Phones only (the header shows these inline from md up): the demo controls
// behind one 44 px button, so the header stays a single row. The sheet closes
// after Skip a week so its toast is not behind the backdrop.
export function DemoMenu({ memberId, daysAhead, planLabel, upgrade }: { memberId: string; daysAhead: number; planLabel: string; upgrade: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cn(
          "press order-4 ml-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-status-due-soft px-2.5 text-label font-medium text-status-due outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden",
        )}
        aria-label="Demo data"
        title="Demo data"
      >
        <FlaskConical aria-hidden className="size-4.5" />
        {daysAhead > 0 && <span className="font-mono text-caption">+{daysAhead}d</span>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 rounded-t-3xl border-t border-border bg-popover px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-lg outline-none transition-transform duration-300 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full">
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Dialog.Title className="text-title">Demo data</Dialog.Title>
              <Dialog.Description className="text-label text-muted-foreground">Synthetic family, your own copy.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted">
              <X aria-hidden className="size-4.5" />
            </Dialog.Close>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DemoClock memberId={memberId} daysAhead={daysAhead} onSkip={() => setOpen(false)} />
            <ResetDemo />
          </div>
          <Link
            href="/pricing"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-label font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Crown aria-hidden className="size-4 text-muted-foreground" />
            {upgrade ? "Upgrade" : planLabel}
          </Link>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
