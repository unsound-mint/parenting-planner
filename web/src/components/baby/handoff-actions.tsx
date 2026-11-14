"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { roleAccent, roleLabel } from "@/lib/visuals";
import type { Person } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AcceptHandoff({ memberId, handoffId, fromName }: { memberId: string; handoffId: string; fromName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      className="h-12 w-full gap-2 text-body font-semibold"
      onClick={() =>
        startTransition(async () => {
          const { error } = await api.POST("/members/{memberId}/handoffs/{handoffId}/accept", {
            params: { path: { memberId, handoffId } },
          });
          if (error) {
            toast.error(error.message ?? "Could not accept. Please try again.");
            return;
          }
          toast.success(`You have the baby now. ${fromName} is off duty.`);
          router.refresh();
        })
      }
    >
      <Check aria-hidden className="size-5" />
      Accept and take over
    </Button>
  );
}

// Pick who is next (faces, not a dropdown) and leave one note. The receiver
// sees the live care summary next to the note, so the note is for what the log cannot say.
export function HandoffForm({ memberId, recipients, childName }: { memberId: string; recipients: Person[]; childName: string }) {
  const router = useRouter();
  const [to, setTo] = useState<string | null>(recipients.length === 1 ? recipients[0].id : null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to) return;
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/handoffs", {
        params: { path: { memberId } },
        body: { toMemberId: to, note: note.trim() || undefined },
      });
      if (error) {
        toast.error(error.message ?? "Could not hand over. Please try again.");
        return;
      }
      const name = recipients.find((r) => r.id === to)?.displayName ?? "them";
      toast.success(`Handoff sent. ${name} accepts it on their screen.`);
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={`Who takes over ${childName}`} className="flex flex-wrap gap-2">
        {recipients.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={to === r.id}
            onClick={() => setTo(r.id)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-full border py-1 pr-4 pl-1 text-label font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              to === r.id ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-background hover:bg-muted",
            )}
          >
            <span aria-hidden className={cn("flex size-8 items-center justify-center rounded-full text-label font-semibold text-card", roleAccent[r.role].bg)}>
              {r.displayName.charAt(0).toUpperCase()}
            </span>
            <span className="flex flex-col items-start leading-tight">
              {r.displayName}
              <span className="text-caption font-normal text-muted-foreground">{roleLabel[r.role]}</span>
            </span>
          </button>
        ))}
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        aria-label="Note for the next person"
        placeholder="Anything the log does not say, like cream on the changing table"
        className="min-h-20 text-base"
      />
      <Button type="submit" size="lg" disabled={!to || pending} className="h-11 gap-2 text-label font-semibold">
        <Send aria-hidden className="size-4" />
        Hand over
      </Button>
    </form>
  );
}
