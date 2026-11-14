"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PsychologistBooking } from "@/lib/api/types";
import { formatClock, formatMonth, formatDayNumber } from "@/lib/format";
import { careIcon } from "@/lib/visuals";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// A short note after a session. Always private to the author; it shapes the
// next weekly plan, which is why it is worth a minute.
export function SessionNoteCard({ memberId, booking }: { memberId: string; booking: PsychologistBooking }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const Note = careIcon.note;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/session-notes", {
        params: { path: { memberId } },
        body: { bookingId: booking.id, text: text.trim() },
      });
      if (error) {
        toast.error("Could not save your note. Please try again.");
        return;
      }
      toast.success("Note saved. It will shape your next plan.");
      setText("");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="note-title" className="rounded-2xl border border-border bg-card p-6">
      <p className="text-caption font-semibold tracking-[0.07em] text-primary uppercase">Your next step</p>
      <div className="mt-3 flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-due-soft text-status-due">
          <Note className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="note-title" className="text-title">
            A few words about your session
          </h2>
          <p className="font-mono text-caption text-muted-foreground">
            {booking.provider.name} · {formatMonth(booking.startsAt)} {formatDayNumber(booking.startsAt)}, {formatClock(booking.startsAt)} ET
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <Textarea
          aria-label="Session note"
          maxLength={1000}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What helped, what you want to try this week, what to raise next time."
        />
        <Button type="submit" size="lg" disabled={!text.trim() || pending} className="h-11 sm:w-fit sm:px-6">
          {pending ? "Saving..." : "Save note"}
        </Button>
      </form>
      <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-caption text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Private to you. It only changes your own plan.
      </p>
    </section>
  );
}
