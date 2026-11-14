"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Check, ChevronDown } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Guide } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import type { LessonAction } from "@/lib/learn";
import { lessonActionIcon } from "@/lib/visuals";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  memberId: string;
  guide: Guide;
  action: LessonAction;
  /** The same task or question is already there (checked against the lists on load). */
  done: boolean;
  /** A lesson written for one parent only, for example "For partners". */
  audience?: string;
};

const labels: Record<LessonAction["kind"], { idle: string; done: string; doneHref?: string }> = {
  task: { idle: "Add to my plan", done: "In your plan", doneHref: "plan" },
  question: { idle: "Ask at the next visit", done: "On your visit list", doneHref: "" },
  practice: { idle: "Practice this", done: "Practice this" },
  shift: { idle: "Commit to this shift", done: "On your calendar", doneHref: "calendar" },
};

// One lesson: what it says, opening in place, and the single thing to do about it.
export function LessonCard({ memberId, guide, action, done: alreadyDone, audience }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const done = alreadyDone || saved;
  const Icon = lessonActionIcon[action.kind];
  const text = labels[action.kind];
  const base = `/family/${memberId}`;

  function run() {
    startTransition(async () => {
      const path = { params: { path: { memberId } } };
      let failed = false;
      if (action.kind === "task") {
        const { error } = await api.POST("/members/{memberId}/tasks", { ...path, body: { title: action.title, detail: guide.title } });
        failed = !!error;
      } else if (action.kind === "question") {
        const { error } = await api.POST("/members/{memberId}/appointment-questions", { ...path, body: { text: action.text, visibility: "partner" } });
        failed = !!error;
      } else if (action.kind === "shift") {
        const { error } = await api.POST("/members/{memberId}/shifts", {
          ...path,
          body: { title: action.title, days: action.days, startTime: action.startTime, endTime: action.endTime },
        });
        if (error?.code === "shift_overlap") {
          toast.error("That overlaps a shift you already have.");
          return;
        }
        failed = !!error;
      }
      if (failed) {
        toast.error("Could not save that. Please try again.");
        return;
      }
      setSaved(true);
      toast.success(action.kind === "task" ? "Added to your plan" : action.kind === "question" ? "Added to your visit list" : "Shift saved");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col rounded-3xl border border-line bg-card p-5.5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-ink-2">
          <BookOpen className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-title">{guide.title}</h2>
          <p className="mt-1 text-label font-normal text-muted-foreground">{guide.summary}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-caption text-muted-foreground">
            {guide.minutes != null && <span>{guide.minutes} min</span>}
            {audience && <span>{audience}</span>}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-3 flex min-h-11 items-center gap-1 self-start rounded-lg px-1 text-label text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        {open ? "Hide the steps" : "Read the steps"}
        <ChevronDown className={cn("size-4 transition-transform duration-220 ease-(--ease-out)", open && "rotate-180")} aria-hidden />
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <ol className="list-decimal pb-2 pl-5 text-body">
            {guide.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="pb-2 font-mono text-caption text-muted-foreground">
            Demo content, not medical advice.{" "}
            <a href={guide.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
              {guide.source.title}
            </a>
            , checked {formatLongDate(guide.source.checkedAt)}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-3">
        {action.kind === "practice" ? (
          <Link href={`${base}/simulator`} className={cn(buttonVariants({ variant: "secondary" }), "press h-11 w-full gap-2 rounded-full px-4.5 text-label sm:w-auto")}>
            <Icon className="size-4" aria-hidden />
            {action.label ?? text.idle}
          </Link>
        ) : done ? (
          <Link
            href={`${base}${text.doneHref ? `/${text.doneHref}` : ""}`}
            className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full gap-2 rounded-full px-4.5 text-label text-leaf sm:w-auto")}
          >
            <Check className="size-4" aria-hidden />
            {text.done}
          </Link>
        ) : (
          <Button type="button" onClick={run} disabled={pending} className="press h-11 w-full gap-2 rounded-full px-4.5 text-label sm:w-auto">
            <Icon className="size-4" aria-hidden />
            {pending ? "Saving..." : (action.label ?? text.idle)}
          </Button>
        )}
      </div>
    </li>
  );
}
