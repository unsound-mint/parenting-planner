"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, CornerDownRight, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import type { AppointmentQuestion, CalendarEvent, Visibility } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { visibilityIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Share choices for a new question. Questions are health data: private unless
// the author picks otherwise (docs/product.md).
function audiences(partnerName?: string): { value: Visibility; label: string }[] {
  return [
    { value: "private", label: "Only me" },
    ...(partnerName ? [{ value: "partner" as const, label: partnerName }] : []),
  ];
}

export function QuestionsCard({
  memberId,
  partnerName,
  appointments,
  questions,
}: {
  memberId: string;
  partnerName?: string;
  appointments: CalendarEvent[];
  questions: AppointmentQuestion[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [pending, startTransition] = useTransition();
  const choices = audiences(partnerName);

  const byVisit = appointments.map((visit) => ({
    visit,
    items: questions.filter((q) => q.appointmentId === visit.id),
  }));
  const unplaced = questions.filter((q) => !q.appointmentId || !appointments.some((a) => a.id === q.appointmentId));

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/appointment-questions", {
        params: { path: { memberId } },
        body: { text: value, visibility },
      });
      if (error) {
        toast.error(error.code === "no_upcoming_appointment" ? "There is no visit to attach it to yet." : "Could not save your question. Please try again.");
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="questions-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="questions-title" className="text-title">
          Ask at your visit
        </h2>
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {byVisit.map(({ visit, items }) => (
          <Visit key={visit.id} visit={visit} items={items} memberId={memberId} />
        ))}
        {unplaced.length > 0 && (
          <div>
            <p className="text-label font-medium text-muted-foreground">No visit booked yet</p>
            <ul className="mt-2 flex flex-col">
              {unplaced.map((q) => (
                <Question key={q.id} q={q} memberId={memberId} />
              ))}
            </ul>
          </div>
        )}
        {questions.length === 0 && appointments.length === 0 && (
          <p className="flex items-center gap-2 text-label text-muted-foreground">
            <CalendarClock className="size-4.5 shrink-0" aria-hidden />
            Write a question down and it waits for your next visit.
          </p>
        )}
      </div>

      <form onSubmit={add} className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex gap-2">
          <Input
            aria-label="New question"
            placeholder="Add a question"
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-11 flex-1 md:h-9"
          />
          <Button type="submit" size="icon" aria-label="Add question" disabled={!text.trim() || pending} className="size-11 md:size-9">
            <Plus />
          </Button>
        </div>
        {choices.length > 1 && (
          <div role="radiogroup" aria-label="Who can see this question" className="flex gap-1.5">
            {choices.map((c) => {
              const Icon = visibilityIcon[c.value];
              const on = visibility === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setVisibility(c.value)}
                  className={cn(
                    "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-caption transition-colors duration-150 md:h-8",
                    on ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
      </form>
    </section>
  );
}

function Visit({ visit, items, memberId }: { visit: CalendarEvent; items: AppointmentQuestion[]; memberId: string }) {
  const waiting = items.filter((q) => !q.answered).length;
  return (
    <div>
      {/* The visit itself shows only here on This week, so its title is never cut. */}
      <div className="flex items-start gap-3">
        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 font-mono text-caption text-secondary-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          <time dateTime={visit.startsAt}>{formatShortDate(visit.startsAt.slice(0, 10))}</time>
        </span>
        <p className="min-w-0 flex-1 pt-1 text-label font-semibold text-balance">{visit.title}</p>
        <span className="shrink-0 pt-1.5 font-mono text-caption text-muted-foreground">{waiting === 0 ? "all asked" : `${waiting} to ask`}</span>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-col">
          {items.map((q) => (
            <Question key={q.id} q={q} memberId={memberId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Question({ q, memberId }: { q: AppointmentQuestion; memberId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [pending, startTransition] = useTransition();

  function save(answered: boolean, text?: string) {
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/appointment-questions/{questionId}", {
        params: { path: { memberId, questionId: q.id } },
        body: { answered, answer: text?.trim() || undefined },
      });
      if (error) {
        toast.error("Could not update the question. Please try again.");
        return;
      }
      setEditing(false);
      setAnswer("");
      router.refresh();
    });
  }

  return (
    <li className="border-b border-border/60 py-2 last:border-b-0">
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={q.answered ? "Reopen question" : "Mark answered"}
          disabled={pending}
          onClick={() => (q.answered ? save(false) : setEditing((v) => !v))}
          className="-m-1.5 grid size-11 shrink-0 place-items-center rounded-full md:size-8"
        >
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full border-2 transition-colors duration-150",
              q.answered ? "border-status-ok bg-status-ok text-primary-foreground" : "border-border",
            )}
          >
            {q.answered && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
          </span>
        </button>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cn("text-body", q.answered && "text-muted-foreground")}>{q.text}</p>
          {q.carriedOver && !q.answered && (
            <span className="mt-1 inline-flex h-5 items-center gap-1 rounded-full bg-status-due-soft px-2 text-caption font-medium text-status-due">
              <CornerDownRight className="size-3" aria-hidden />
              Carried over
            </span>
          )}
          {q.answered && q.answer && <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-label">{q.answer}</p>}
        </div>
        {q.visibility !== "private" && <VisibilityMark visibility={q.visibility} />}
      </div>

      {editing && !q.answered && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(true, answer);
          }}
          className="mt-2 ml-14 flex flex-col gap-2 md:ml-11"
        >
          <Input aria-label="Answer" placeholder="What did they say? (optional)" maxLength={500} value={answer} onChange={(e) => setAnswer(e.target.value)} className="h-11 md:h-9" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="h-11 flex-1 text-label md:h-8">
              {pending ? "Saving..." : "Mark answered"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} className="h-11 text-label md:h-8">
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function VisibilityMark({ visibility }: { visibility: Visibility }) {
  const Icon = visibilityIcon[visibility];
  return <Icon className="mt-1.5 size-4 shrink-0 text-muted-foreground" aria-label={`Visible to: ${visibility.replace("_", " ")}`} />;
}
