"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, CalendarPlus, Check, Pill, Utensils } from "lucide-react";
import { api } from "@/lib/api/client";
import type { SafetyEntry } from "@/lib/api/types";
import { SourceLine } from "@/components/joy/source-line";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { statusLook } from "./status";

export type Mode = "pregnancy" | "breastfeeding";

/** The question saved for the next visit. It asks; it never claims anything is fine. */
export const questionFor = (e: SafetyEntry, mode: Mode) =>
  `${e.category === "medicine" ? "Is it OK for me to take" : "Is it OK for me to have"} ${e.name.toLowerCase()} ${mode === "pregnancy" ? "while pregnant" : "while breastfeeding"}?`;

export function ReferenceCard({ entry, mode, memberId, saved, onSaved }: { entry: SafetyEntry; mode: Mode; memberId: string; saved: boolean; onSaved: (text: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const advice = mode === "pregnancy" ? entry.pregnancy : entry.breastfeeding;
  const look = statusLook[advice?.status ?? "ask"];
  const Icon = look.icon;
  const text = questionFor(entry, mode);
  const canSave = entry.category === "medicine" || advice?.status === "ask" || !advice;

  function save() {
    startTransition(async () => {
      // Health questions start private; the parent can share them from the visit list.
      const { error } = await api.POST("/members/{memberId}/appointment-questions", { params: { path: { memberId } }, body: { text, visibility: "private" } });
      if (error) {
        toast.error(error.code === "no_upcoming_appointment" ? "No upcoming appointment yet. Add one in the calendar, then save this." : "Could not save that. Please try again.");
        return;
      }
      onSaved(text);
      toast.success("Saved for your next appointment. Only you can see it.");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-line bg-card p-5.5 md:p-6">
      <div className="flex items-start gap-4">
        <span aria-hidden className={cn("flex size-14 shrink-0 items-center justify-center rounded-full ring-4", look.badge, look.ring)}>
          <Icon className="size-7" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-title">{entry.name}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-label font-semibold">
            <span className={cn("rounded-full px-2.5 py-0.5", look.badge)}>{advice ? look.label : statusLook.ask.label}</span>
            <span className="inline-flex items-center gap-1 font-mono text-caption font-normal text-muted-foreground">
              {entry.category === "medicine" ? <Pill className="size-3.5" aria-hidden /> : <Utensils className="size-3.5" aria-hidden />}
              {entry.category}
            </span>
          </p>
        </div>
      </div>

      <p className="text-body text-ink-2">
        {advice?.why ?? "We have not opened a breastfeeding source for this one yet, so it is a question for your OB, midwife or pharmacist."}
      </p>

      {entry.ask && <p className="rounded-2xl bg-status-up-soft px-4 py-2.5 text-label font-medium text-status-up">{entry.ask}</p>}

      <div className="mt-auto flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="min-h-11 self-start rounded-lg text-label text-muted-foreground underline decoration-line-2 underline-offset-4 transition-colors duration-150 hover:text-foreground"
        >
          {open ? "Hide sources" : "Sources and dates"}
        </button>
        <div className={cn("grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!open}>
          <div className="min-h-0 overflow-hidden">
            <SourceLine sources={entry.sources} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSave &&
            (saved ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-full px-4.5 text-label text-leaf">
                <Check className="size-4" aria-hidden />
                On your visit list
              </span>
            ) : (
              <Button type="button" variant="secondary" onClick={save} disabled={pending} className="press h-11 gap-2 rounded-full px-4.5 text-label">
                <CalendarPlus className="size-4" aria-hidden />
                {pending ? "Saving..." : "Save to ask at my next appointment"}
              </Button>
            ))}
          {entry.learn && (
            <Link href={`/family/${memberId}/learn?path=${entry.learn.pathId}&lesson=${entry.learn.lessonId}`} className="press inline-flex h-11 items-center gap-2 rounded-full px-3 text-label text-muted-foreground transition-colors hover:text-foreground">
              <BookOpen className="size-4" aria-hidden />
              Read the lesson
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
