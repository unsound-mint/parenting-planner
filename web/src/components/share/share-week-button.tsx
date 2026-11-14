"use client";

import { Share2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareWeekCard } from "./share-week-card";

/**
 * The entry on the This week hero: a quiet "Share this week" button that opens
 * the card in a dialog. The native <dialog> gives focus trapping, Escape and a
 * backdrop for free; the card inside only loads once the dialog is opened.
 *
 * shareLine is the headline the card carries ("Week 25: about the size of a
 * zucchini", see pregnancyShareLine in lib/share.ts, or the stage headline).
 */
export function ShareWeekButton({ memberId, shareLine, suggestedNickname, className }: { memberId: string; shareLine: string; suggestedNickname?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); dialog.current?.showModal(); }} className={`press h-11 gap-2 rounded-full bg-card px-4 text-label ${className ?? ""}`}>
        <Share2 aria-hidden className="size-4" />
        Share this week
      </Button>
      <dialog
        ref={dialog}
        aria-label="Share this week"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-[1.75rem] border border-line bg-paper p-5.5 text-foreground opacity-0 shadow-xl backdrop:bg-ink/30 open:opacity-100 md:p-8 starting:open:opacity-0 starting:open:translate-y-3 translate-y-0 transition-[opacity,translate,overlay,display] transition-discrete duration-(--duration-slow) ease-(--ease-out)"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-headline">Share this week</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => dialog.current?.close()} className="size-11 rounded-full">
            <X aria-hidden className="size-5" />
          </Button>
        </div>
        {open && <ShareWeekCard memberId={memberId} shareLine={shareLine} suggestedNickname={suggestedNickname} />}
      </dialog>
    </>
  );
}
