"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import type { AppointmentQuestion, Visibility } from "@/lib/api/types";
import { visibilityIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Question, audiences } from "./appointment-questions-card";

// The questions list of one visit with its own add field. The rows and the
// answering are the same ones This week shows (Question).
export function VisitQuestions({ memberId, appointmentId, partnerName, questions }: { memberId: string; appointmentId: string; partnerName?: string; questions: AppointmentQuestion[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [pending, startTransition] = useTransition();
  const choices = audiences(partnerName);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/appointment-questions", {
        params: { path: { memberId } },
        body: { text: value, visibility, appointmentId },
      });
      if (error) {
        toast.error("Could not save your question. Please try again.");
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div>
      {questions.length > 0 && (
        <ul className="flex flex-col">
          {questions.map((q) => (
            <Question key={q.id} q={q} memberId={memberId} />
          ))}
        </ul>
      )}
      <form onSubmit={add} className={cn("flex flex-col gap-2", questions.length > 0 && "mt-3 border-t border-border pt-3")}>
        <div className="flex gap-2">
          <Input aria-label="New question" placeholder="Add a question for this visit" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} className="h-11 flex-1 md:h-9" />
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
                  className={cn("inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-caption transition-colors duration-150 md:h-8", on ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
      </form>
    </div>
  );
}
