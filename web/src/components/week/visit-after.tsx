"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Check, ListPlus, Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { AppointmentNote, CalendarEvent } from "@/lib/api/types";
import { easternInstant } from "@/lib/schedule";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// The after-visit view of an appointment: a private note and one next step.
// The questions are the same rows as before the visit (Question, after).

export function VisitNote({ memberId, appointmentId, note }: { memberId: string; appointmentId: string; note?: AppointmentNote }) {
  const router = useRouter();
  // The saved text is kept locally too, so the card is right before the refresh lands.
  const [saved, setSaved] = useState(note?.text ?? "");
  const [text, setText] = useState(note?.text ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = text.trim() !== saved;

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const { data, error } = await api.PUT("/members/{memberId}/appointments/{appointmentId}/note", {
        params: { path: { memberId, appointmentId } },
        body: { text: text.trim() },
      });
      if (error || !data) {
        toast.error("Could not save your note. Please try again.");
        return;
      }
      setSaved(data.text);
      setText(data.text);
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Textarea aria-label="Your note about this visit" placeholder="What did you take away? Numbers, advice, how you felt." maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="min-h-28 text-body" />
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          Only you can read this
        </span>
        <Button type="submit" disabled={!dirty || pending} className="h-11 px-5 text-label md:h-9">
          {pending ? "Saving..." : saved && !dirty ? "Saved" : "Save note"}
        </Button>
      </div>
    </form>
  );
}

type Step = "task" | "visit";
const steps: { value: Step; label: string; icon: typeof ListPlus }[] = [
  { value: "task", label: "Add a task", icon: ListPlus },
  { value: "visit", label: "Book the next visit", icon: CalendarPlus },
];

/** One next action. suggestedDate (YYYY-MM-DD) is where the next visit usually falls. */
export function NextStep({ memberId, appointment, suggestedDate }: { memberId: string; appointment: CalendarEvent; suggestedDate: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("task");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [date, setDate] = useState(suggestedDate);
  const [time, setTime] = useState("09:30");
  const [done, setDone] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (step === "task") {
        const { error } = await api.POST("/members/{memberId}/tasks", {
          params: { path: { memberId } },
          body: { title: title.trim(), kind: "task", ...(due ? { dueOn: due } : {}) },
        });
        if (error) {
          toast.error("Could not add the task. Please try again.");
          return;
        }
        setDone(title.trim());
        setTitle("");
      } else {
        const { error } = await api.POST("/members/{memberId}/calendar-events", {
          params: { path: { memberId } },
          body: { kind: "appointment", title: appointment.title, startsAt: easternInstant(date, time), location: appointment.location, attendeeIds: [memberId], visibility: "family", neutralTitle: true },
        });
        if (error) {
          toast.error("Could not book the visit. Please try again.");
          return;
        }
        setDone(`${appointment.title}, ${formatLongDate(date)}`);
      }
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-status-ok text-primary-foreground">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-label font-semibold">{done}</p>
        <Button type="button" variant="ghost" onClick={() => setDone(undefined)} className="h-11 text-label md:h-9">
          Add another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Next step" className="flex flex-wrap gap-1.5">
        {steps.map(({ value, label, icon: Icon }) => {
          const on = step === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStep(value)}
              className={cn("inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-label transition-colors duration-150 md:h-9", on ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:bg-muted")}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      {step === "task" ? (
        <>
          <Input aria-label="Task" placeholder="e.g. Schedule the glucose test" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 md:h-9" />
          <label className="flex items-center justify-between gap-3 text-label text-muted-foreground">
            Due (optional)
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-11 w-44 font-mono md:h-9" />
          </label>
        </>
      ) : (
        <div className="flex gap-2">
          <Input type="date" aria-label="Date of the next visit" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 flex-1 font-mono md:h-9" />
          <Input type="time" aria-label="Time of the next visit" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 w-32 font-mono md:h-9" />
        </div>
      )}
      <Button type="submit" disabled={pending || (step === "task" ? !title.trim() : !date || !time)} className="h-11 text-label md:h-9">
        {pending ? "Saving..." : step === "task" ? "Add task" : "Book visit"}
      </Button>
    </form>
  );
}
