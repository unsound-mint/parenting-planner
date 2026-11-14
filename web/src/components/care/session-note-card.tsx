"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PsychologistBooking } from "@/lib/api/types";
import { formatWeekday } from "@/lib/format";
import { Button } from "@/components/ui/button";

// One line after a session. Always private to the author (the API has no
// visibility for notes); it shapes the author's next weekly plan.
export function SessionNoteCard({ memberId, booking }: { memberId: string; booking: PsychologistBooking }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

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
      toast.success("Noted. Your next plan will use it.");
      setText("");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="note-title" className="min-w-0 rounded-3xl border border-line bg-card p-5.5 md:rounded-[1.75rem] md:p-7">
      <h2 id="note-title" className="text-title font-semibold">
        After {formatWeekday(booking.startsAt)}&apos;s session
      </h2>
      <p className="mt-1 text-label font-normal text-muted-foreground">One line on what helped makes the next plan kinder.</p>
      <form onSubmit={submit} className="mt-4 flex items-center gap-2 rounded-full border border-line-2 bg-paper p-1 pl-5 focus-within:ring-3 focus-within:ring-ring/50">
        <label htmlFor="session-note" className="sr-only">
          Session note
        </label>
        <input
          id="session-note"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Breathing before sleep helped"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={!text.trim() || pending} className="press h-11 rounded-full px-5">
          {pending ? "Saving..." : "Save"}
        </Button>
      </form>
      <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Only you. It never goes to anyone else.
      </p>
    </section>
  );
}
